// Checks of the files that Cloudflare and GitHub read to build and serve the site (K14):
// `wrangler.jsonc`, `public/_headers`, `index.html`, `.github/workflows/gate.yml`.
// Every `check…` function takes the file text and returns a list of problems; none of them
// throws, whatever it is given. Run by `scripts/deploy-config.test.mjs` as part of `npm run gate`.

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
/** The site's own domain (K120, M4.7). */
export const SITE_DOMAIN = 'hacks.antipic.com';
const DATA_ALLOWED_IN = new Set(['img-src', 'font-src']);
// wrangler.jsonc is an allow-list: a new key is a decision, so it is added here on purpose.
const WRANGLER_KEYS = new Set([
  '$schema',
  'name',
  'compatibility_date',
  'assets',
  'workers_dev',
  'preview_urls',
  'previews',
  'routes',
]);
const ASSETS_KEYS = new Set(['directory', 'not_found_handling', 'html_handling']);
const WRANGLER_REASONS = {
  main: 'the site has no server code',
  account_id: 'Cloudflare supplies it during the build',
  route: 'the site domain is one custom domain in `routes` (M4.7, K120)',
  env: 'there is one Worker; branches get previews, not environments',
};

/**
 * Parses a Cloudflare `_headers` file: a URL pattern at the start of a line, then indented
 * `Name: value` lines. A `! Name` line (detach) is kept with the value `null`. A name repeated
 * inside one rule is joined with a comma, as Cloudflare does. Throws on anything but a string.
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
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    const before = current.headers[name];
    current.headers[name] = typeof before === 'string' ? `${before}, ${value}` : value;
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
  if (typeof text !== 'string') return ['_headers must be text'];
  const rules = parseHeaders(text);
  const first = rules.find((rule) => rule.pattern === '/*');
  const all = first?.headers ?? {};
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
  // Rules add up: any other rule, a second /* block included, can detach or change a header.
  for (const rule of rules) {
    if (rule === first) continue;
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
  for (const key of Object.keys(config)) {
    if (!WRANGLER_KEYS.has(key) && !(key in WRANGLER_REASONS)) {
      problems.push(`${key} is not on the list of known keys in scripts/deploy-config.mjs`);
    }
  }
  for (const [key, reason] of Object.entries(WRANGLER_REASONS)) {
    if (key in config) problems.push(`${key} must not be set: ${reason}`);
  }
  if (config.name !== 'hacks-explorer') {
    problems.push('name must be hacks-explorer, the name of the Worker in Cloudflare');
  }
  const date = config.compatibility_date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    problems.push('compatibility_date must be a date YYYY-MM-DD that is not in the future');
  }
  const assets = config.assets;
  if (assets === null || typeof assets !== 'object' || Array.isArray(assets)) {
    problems.push('assets must be set: the site is static files only');
  } else {
    for (const key of Object.keys(assets)) {
      if (!ASSETS_KEYS.has(key)) problems.push(`assets.${key} is not on the list of known keys`);
    }
    if (assets.directory !== './dist') {
      problems.push('assets.directory must be ./dist, where `npm run build` writes');
    }
    if (assets.not_found_handling !== 'single-page-application') {
      problems.push('assets.not_found_handling must be single-page-application');
    }
    if (assets.html_handling !== 'auto-trailing-slash') {
      problems.push(
        'assets.html_handling must be auto-trailing-slash: /ru/lesson/K1 is served from ru/lesson/K1.html (M4.3)',
      );
    }
  }
  const previews = config.previews;
  if (previews === null || typeof previews !== 'object' || Array.isArray(previews)) {
    problems.push('previews must be an object: `wrangler preview` needs the block');
  }
  // M4.7 (K120): the owner allowed the site on hacks.antipic.com; exactly that custom domain.
  const routes = config.routes;
  if (
    routes !== undefined &&
    !(
      Array.isArray(routes) &&
      routes.length === 1 &&
      routes[0] !== null &&
      typeof routes[0] === 'object' &&
      Object.keys(routes[0]).sort().join(',') === 'custom_domain,pattern' &&
      routes[0].pattern === SITE_DOMAIN &&
      routes[0].custom_domain === true
    )
  ) {
    problems.push(
      `routes must be exactly [{ pattern: '${SITE_DOMAIN}', custom_domain: true }] (K120)`,
    );
  }
  if (config.workers_dev !== true) {
    problems.push('workers_dev must be true: the draft and preview addresses use it');
  }
  if (config.preview_urls !== true) {
    problems.push('preview_urls must be true: set it, do not rely on the Cloudflare default');
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
  for (const match of html.matchAll(
    /\b(?:src|href)\s*=\s*["']?\s*((?:[a-z][a-z0-9+.-]*:|\/\/)[^\s"'>]*)/gi,
  )) {
    problems.push(`the page must not load from another server or scheme: ${match[1] ?? ''}`);
  }
  return problems;
}

/** @param {string} text contents of `.github/workflows/gate.yml` @returns {string[]} */
export function checkCi(text) {
  const yaml = String(text).replace(/(^|\s)#.*$/gm, '$1');
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
  if (/\bsecrets\s*[.[]/.test(yaml)) problems.push('must not use secrets');
  // Every permissions block, at any level, may only read.
  const lines = yaml.split('\n');
  lines.forEach((line, index) => {
    const head = /^(\s*)permissions:\s*(.*)$/.exec(line);
    if (head === null) return;
    const indent = (head[1] ?? '').length;
    const granted = (head[2] ?? '') === '' ? [] : [`permissions: ${head[2] ?? ''}`];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() === '') continue;
      if ((/^\s*/.exec(next)?.[0].length ?? 0) <= indent) break;
      granted.push(next.trim());
    }
    for (const grant of granted) {
      if (!/^[\w-]+:\s*(read|none)$/.test(grant)) {
        problems.push(`permissions may only read, found: ${grant}`);
      }
    }
  });
  if (/wrangler|cloudflare|\bdeploy/i.test(yaml)) {
    problems.push('must not deploy: Cloudflare builds and deploys by itself (K12, K14)');
  }
  return problems;
}
