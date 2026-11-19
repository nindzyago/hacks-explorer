#!/usr/bin/env node
// Static server for the e2e tests: serves a built folder the way the production host
// (Cloudflare) does, in the parts that can break a reader's page:
//   - headers from the `_headers` file in that folder (the CSP lives there);
//   - a path without an extension is served from `<path>.html` when that file exists (M4.3, the
//     static page of a lesson; Cloudflare assets.html_handling "auto-trailing-slash");
//   - any unknown path answers with index.html (the site routes in the browser);
//   - nothing outside the folder is ever served.
// No dependencies. Usage: node scripts/serve-static.mjs <folder> <port>
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
};
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

/**
 * Reads the `_headers` format: a path pattern on its own line, then indented `Name: value`
 * lines. `#` starts a comment. Lines that fit neither are skipped. Never throws.
 * Not supported (not used by this project): `:placeholder` patterns and `! Name` removals.
 * @param {string} text
 * @returns {{ pattern: string, headers: [string, string][] }[]}
 */
export function parseHeadersFile(text) {
  /** @type {{ pattern: string, headers: [string, string][] }[]} */
  const rules = [];
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = null;
      if (trimmed.startsWith('/')) {
        current = { pattern: trimmed, headers: [] };
        rules.push(current);
      }
      continue;
    }
    if (current === null) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (HEADER_NAME.test(name) && value !== '') current.headers.push([name, value]);
  }
  return rules;
}

function matches(pattern, pathname) {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`).test(pathname);
}

/**
 * Headers of every rule that matches `pathname`; a header set by several rules is joined
 * with a comma, as the production host does.
 * @param {{ pattern: string, headers: [string, string][] }[]} rules
 * @param {string} pathname
 * @returns {Record<string, string>}
 */
export function headersFor(rules, pathname) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const rule of rules) {
    if (!matches(rule.pattern, pathname)) continue;
    for (const [name, value] of rule.headers) {
      result[name] = Object.hasOwn(result, name) ? `${result[name]}, ${value}` : value;
    }
  }
  return result;
}

/** The file a request path names, or null when it is not a servable file inside `root`. */
function fileFor(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/');
  if (segments.includes('..')) return null;
  const file = resolve(join(root, ...segments));
  if (file === root || !file.startsWith(root + sep)) return null;
  if (file === join(root, '_headers')) return null;
  // M4.3: `/ru/lesson/K1` is the page `ru/lesson/K1.html`; a slash at the end is a folder.
  if (extname(file) === '') return decoded.endsWith('/') ? null : `${file}.html`;
  return file;
}

async function readOrNull(file) {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/**
 * @param {string} folder the built site
 * @returns {import('node:http').Server}
 */
export function createStaticServer(folder) {
  const root = resolve(folder);

  return createServer((req, res) => {
    void (async () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      // Only the path: the query never selects a file.
      const pathname = (req.url ?? '/').split(/[?#]/)[0] || '/';

      const wanted = fileFor(root, pathname);
      let file = wanted;
      let body = wanted === null ? null : await readOrNull(wanted);
      if (body === null) {
        file = join(root, 'index.html');
        body = await readOrNull(file);
      }
      if (body === null || file === null) {
        res
          .writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          .end(`no index.html in ${root}: build the site first\n`);
        return;
      }

      // Read on every request: the file is small, and a rebuild is picked up without a restart.
      const headersText = await readOrNull(join(root, '_headers'));
      const extra = headersText === null ? {} : headersFor(parseHeadersFile(headersText), pathname);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': body.byteLength,
        ...extra,
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}

function main() {
  const [folder, portText] = process.argv.slice(2);
  const port = Number(portText);
  if (folder === undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('usage: node scripts/serve-static.mjs <folder> <port>');
    process.exit(2);
  }
  if (!existsSync(join(folder, 'index.html'))) {
    console.error(`serve-static: no index.html in ${resolve(folder)}: build the site first`);
    process.exit(1);
  }
  createStaticServer(folder).listen(port, '127.0.0.1', () => {
    console.log(`serve-static: ${resolve(folder)} on port ${String(port)}`);
  });
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
