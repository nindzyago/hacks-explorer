// Checks of the files that Cloudflare and GitHub read to build and serve the site (K13):
// `wrangler.jsonc`, `public/_headers`, `index.html`, `.github/workflows/gate.yml`.
// Every check takes the file text and returns a list of problems; none of them throws on
// broken input. Run by `scripts/deploy-config.test.mjs` as part of `npm run gate`.

const REQUIRED_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];
// Directives that do not fall back to default-src, so each must be set.
const REQUIRED_DIRECTIVES = {
  'default-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'", "'none'"],
  'form-action': ["'self'", "'none'"],
  'frame-ancestors': ["'none'"],
};
const DATA_ALLOWED_IN = new Set(['img-src', 'font-src']);

/**
 * Parses a Cloudflare `_headers` file: a URL pattern at the start of a line, then indented
 * `Name: value` lines. A `! Name` line (detach) is kept with the value `null`.
 * @param {string} text
 * @returns {{ pattern: string, headers: Record<string, string | null> }[]}
 */
export function parseHeaders(text) {
  if (typeof text !== 'string') throw new TypeError('parseHeaders expects a string');
  const rules = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { pattern: line, headers: {} };
      rules.push(current);
      continue;
    }
    if (current === null) continue;
    if (line.startsWith('!')) {
      current.headers[line.slice(1).trim().toLowerCase()] = null;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    current.headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return rules;
}

/** @param {string} csp @returns {string[]} */
function checkCsp(csp) {
  const problems = [];
  const directives = new Map();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name === undefined || name === '') continue;
    directives.set(name.toLowerCase(), sources);
  }
  for (const [name, allowed] of Object.entries(REQUIRED_DIRECTIVES)) {
    const sources = directives.get(name);
    if (sources?.length !== 1 || !allowed.includes(sources[0] ?? '')) {
      problems.push(`Content-Security-Policy: ${name} must be ${allowed.join(' or ')}`);
    }
  }
  for (const [name, sources] of directives) {
    for (const source of sources) {
      if (source === "'self'" || source === "'none'") continue;
      if (source === 'data:' && DATA_ALLOWED_IN.has(name)) continue;
      problems.push(
        source.startsWith("'")
          ? `Content-Security-Policy: ${name} has the unsafe keyword ${source}`
          : `Content-Security-Policy: ${name} allows another server or scheme: ${source}`,
      );
    }
  }
  return problems;
}

/** @param {string} text contents of `public/_headers` @returns {string[]} */
export function checkHeaders(text) {
  const rules = parseHeaders(text);
  const all = rules.find((rule) => rule.pattern === '/*')?.headers ?? {};
  const problems = [];
  for (const name of REQUIRED_HEADERS) {
    if (typeof all[name] !== 'string') problems.push(`the /* rule must set ${name}`);
  }
  if (typeof all['content-security-policy'] === 'string') {
    problems.push(...checkCsp(all['content-security-policy']));
  }
  if ('x-content-type-options' in all && all['x-content-type-options'] !== 'nosniff') {
    problems.push('x-content-type-options must be nosniff');
  }
  for (const rule of rules) {
    if (rule.pattern === '/*') continue;
    for (const name of REQUIRED_HEADERS) {
      if (name in rule.headers) {
        problems.push(`${rule.pattern}: ${name} is set once, in the /* rule; do not override it`);
      }
    }
  }
  return problems;
}

/** Removes comments and trailing commas from JSONC, leaving strings alone. */
function stripJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** @param {string} text contents of `wrangler.jsonc` @returns {string[]} */
export function checkWrangler(text, today = new Date().toISOString().slice(0, 10)) {
  let config;
  try {
    config = JSON.parse(stripJsonc(String(text)));
  } catch {
    return ['wrangler.jsonc is not valid JSONC'];
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return ['wrangler.jsonc must hold one object'];
  }
  const problems = [];
  if (config.name !== 'hacks-explorer') {
    problems.push('name must be hacks-explorer, the name of the Worker in Cloudflare');
  }
  const date = config.compatibility_date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    problems.push('compatibility_date must be a date YYYY-MM-DD that is not in the future');
  }
  const assets = config.assets;
  if (assets === null || typeof assets !== 'object') {
    problems.push('assets must be set: the site is static files only');
  } else {
    if (assets.directory !== './dist') {
      problems.push('assets.directory must be ./dist, where `npm run build` writes');
    }
    if (assets.not_found_handling !== 'single-page-application') {
      problems.push('assets.not_found_handling must be single-page-application');
    }
  }
  if ('main' in config) problems.push('main must not be set: the site has no server code');
  if (config.previews === null || typeof config.previews !== 'object') {
    problems.push('previews must be an object: `wrangler preview` needs the block');
  }
  if ('account_id' in config) {
    problems.push('account_id must not be set: Cloudflare supplies it during the build');
  }
  if ('workers_dev' in config && config.workers_dev !== true) {
    problems.push('workers_dev must stay on: the draft and preview addresses use it');
  }
  return problems;
}

/** @param {string} text contents of `index.html` @returns {string[]} */
export function checkIndexHtml(text) {
  const html = String(text);
  const problems = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc\s*=/.test(match[1] ?? '')) problems.push('inline <script> is blocked by the CSP');
  }
  if (/<style\b/i.test(html)) problems.push('inline <style> is blocked by the CSP');
  if (/<[^>]+\sstyle\s*=/i.test(html)) problems.push('style="" is blocked by the CSP');
  if (/<[^>]+\son[a-z]+\s*=/i.test(html)) problems.push('inline handlers are blocked by the CSP');
  return problems;
}

/** @param {string} text contents of `.github/workflows/gate.yml` @returns {string[]} */
export function checkCi(text) {
  const yaml = String(text);
  const problems = [];
  if (!/^ {2}pull_request:\s*$/m.test(yaml)) {
    problems.push('must run on every pull_request (and never on pull_request_target)');
  }
  if (/pull_request_target/.test(yaml)) {
    problems.push('pull_request_target runs untrusted code with repository rights');
  }
  if (!/^ {2}push:\s*\n\s+branches:\s*\[main\]/m.test(yaml)) {
    problems.push('must run on pushes to main');
  }
  const permissions = /^permissions:\s*\n((?: +.*\n?)+)/m.exec(yaml)?.[1]?.trim();
  if (permissions !== 'contents: read') {
    problems.push('top-level permissions must be exactly contents: read');
  }
  if (!/^concurrency:\s*\n(?: +.*\n)* +cancel-in-progress: true/m.test(yaml)) {
    problems.push('concurrency must cancel superseded runs');
  }
  if (!/\bnpm ci\b/.test(yaml)) problems.push('must install with npm ci');
  if (!/\bnpm run gate\b/.test(yaml)) problems.push('must run npm run gate');
  if (/\bsecrets\./.test(yaml)) problems.push('must not use secrets');
  return problems;
}
