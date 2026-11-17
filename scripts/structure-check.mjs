#!/usr/bin/env node
// Structure check, part of `npm run gate`.
//
// Rules (AGENTS.md, "Инварианты архитектуры" and L6):
//   layers            core < services < commands < adapters (ui, scene, control, time) < entry;
//                     a file may import its own layer or a lower one.
//   content-is-data   nothing executable under content/.
//   no-external-urls  site code never points at another server.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RANK = { core: 0, services: 1, commands: 2, adapters: 3, entry: 4 };
const DIR_LAYER = {
  core: 'core',
  services: 'services',
  commands: 'commands',
  ui: 'adapters',
  scene: 'adapters',
  control: 'adapters',
  time: 'adapters',
};
const CODE = /\.(ts|js|mjs|cjs|svelte)$/;
const SITE = /\.(ts|js|svelte|css|html)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const URL = /https?:\/\/[^\s'"`<>)]+/g;
const ALLOWED_URL = /^http:\/\/www\.w3\.org\//;

/** @param {string} path repo-relative, forward slashes @returns {keyof typeof RANK | null} */
export function layerOf(path) {
  const parts = path.split('/');
  if (parts[0] !== 'src') return null;
  if (parts.length === 2) return 'entry';
  return DIR_LAYER[parts[1] ?? ''] ?? null;
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * @param {{ path: string, text: string }[]} files
 * @returns {{ rule: string, path: string, line: number, message: string }[]}
 */
export function checkFiles(files) {
  const problems = [];
  for (const file of files) {
    if (typeof file.path !== 'string' || typeof file.text !== 'string') {
      throw new TypeError('checkFiles expects { path: string, text: string }');
    }
    const { path, text } = file;

    if (path.startsWith('content/') && CODE.test(path)) {
      problems.push({
        rule: 'content-is-data',
        path,
        line: 1,
        message: 'content/ holds data only (YAML, images); move code to src/',
      });
    }

    const from = layerOf(path);
    if (from !== null && CODE.test(path)) {
      for (const match of text.matchAll(IMPORT)) {
        const spec = match[2];
        if (spec === undefined || !spec.startsWith('.')) continue;
        const target = posix.normalize(posix.join(posix.dirname(path), spec));
        const to = layerOf(target);
        if (to === null || RANK[to] <= RANK[from]) continue;
        problems.push({
          rule: 'layers',
          path,
          line: lineAt(text, match.index),
          message: `${from} must not import ${to} (${spec})`,
        });
      }
    }

    if ((path === 'index.html' || path.startsWith('src/')) && SITE.test(path)) {
      for (const match of text.matchAll(URL)) {
        if (ALLOWED_URL.test(match[0])) continue;
        problems.push({
          rule: 'no-external-urls',
          path,
          line: lineAt(text, match.index),
          message: `site code must not reference another server: ${match[0]}`,
        });
      }
    }
  }
  return problems;
}

function walk(root, dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const paths = ['index.html'];
  for (const dir of ['src', 'content']) {
    try {
      walk(root, join(root, dir), paths);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const files = [];
  for (const path of paths) {
    if (!CODE.test(path) && !SITE.test(path)) continue;
    try {
      files.push({ path, text: readFileSync(join(root, path), 'utf8') });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const problems = checkFiles(files);
  for (const p of problems) console.error(`${p.path}:${p.line}  ${p.rule}  ${p.message}`);
  if (problems.length > 0) {
    console.error(`structure-check: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`structure-check: ${files.length} file(s), no problems`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
