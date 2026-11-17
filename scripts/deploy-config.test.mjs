// Acceptance for M0.5 (repository side): the files Cloudflare and GitHub read to build and
// serve the site say what K14 decided, and the security headers allow no other server (L6).
// Oracle level A: exact values.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkCi,
  checkHeaders,
  checkIndexHtml,
  checkWrangler,
  parseHeaders,
} from './deploy-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const GOOD_CSP =
  "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; " +
  "form-action 'none'; frame-ancestors 'none'";
const headers = (csp = GOOD_CSP, extra = '') =>
  [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  Permissions-Policy: camera=()',
    extra,
  ].join('\n');
const wrangler = (patch = {}) =>
  JSON.stringify({
    name: 'hacks-explorer',
    compatibility_date: '2026-11-17',
    assets: { directory: './dist', not_found_handling: 'single-page-application' },
    workers_dev: true,
    preview_urls: true,
    previews: {},
    ...patch,
  });
const CI = [
  'on:',
  '  pull_request:',
  '  push:',
  '    branches: [main]',
  'permissions:',
  '  contents: read',
  'concurrency:',
  '  group: gate-${{ github.ref }}',
  '  cancel-in-progress: true',
  'jobs:',
  '  gate:',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '      - run: npm ci',
  '      - run: npm run gate',
].join('\n');

describe('the repository as committed', () => {
  it('has a Workers configuration that serves dist/ as a single-page site', () => {
    expect(checkWrangler(read('wrangler.jsonc'))).toEqual([]);
  });

  it('has security headers that allow only this site', () => {
    expect(checkHeaders(read('public/_headers'))).toEqual([]);
  });

  it('has a page the Content-Security-Policy does not break', () => {
    expect(checkIndexHtml(read('index.html'))).toEqual([]);
  });

  it('runs the gate on every pull request and on main, without secrets', () => {
    expect(checkCi(read('.github/workflows/gate.yml'))).toEqual([]);
  });

  it('builds on Cloudflare with the Node version CI uses', () => {
    expect(read('.node-version').trim()).toBe('22');
    expect(read('.github/workflows/gate.yml')).toMatch(/node-version-file: \.node-version/);
  });
});

describe('parseHeaders', () => {
  it('reads rules, skips comments, lowercases header names', () => {
    const rules = parseHeaders('# note\n/*\n  X-A: 1\n\n/assets/*\n\tX-B: a: b\n');
    expect(rules).toEqual([
      { pattern: '/*', headers: { 'x-a': '1' } },
      { pattern: '/assets/*', headers: { 'x-b': 'a: b' } },
    ]);
  });

  it('survives empty and broken input', () => {
    expect(parseHeaders('')).toEqual([]);
    expect(parseHeaders('  X-Orphan: 1\n  nonsense\n')).toEqual([]);
    expect(() => parseHeaders(undefined)).toThrow(TypeError);
  });
});

describe('checkHeaders', () => {
  it('accepts a strict policy', () => {
    expect(checkHeaders(headers())).toEqual([]);
  });

  it('wants every header on every path', () => {
    expect(checkHeaders('')).toHaveLength(4);
    expect(checkHeaders(headers().replace('/*', '/app/*'))).toContain(
      'the /* rule must set content-security-policy',
    );
    expect(checkHeaders(headers().replace('nosniff', 'sniff'))).toEqual([
      'x-content-type-options must be nosniff',
    ]);
  });

  it.each([
    ["default-src 'self' https://cdn.example.com", 'another server'],
    [`${GOOD_CSP}; img-src 'self' *.example.com`, 'another server'],
    [`${GOOD_CSP}; connect-src *`, 'another server'],
    [`${GOOD_CSP}; img-src https:`, 'another server'],
    [`${GOOD_CSP}; script-src 'self' 'unsafe-inline'`, 'unsafe'],
    [`${GOOD_CSP}; script-src 'self' 'unsafe-eval'`, 'unsafe'],
    [`${GOOD_CSP}; style-src 'self' 'unsafe-inline'`, 'unsafe'],
    [GOOD_CSP.replace("default-src 'self'; ", ''), 'default-src'],
    [GOOD_CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'"), 'frame-ancestors'],
    [GOOD_CSP.replace("; object-src 'none'", ''), 'object-src'],
    [GOOD_CSP.replace("; base-uri 'self'", ''), 'base-uri'],
  ])('rejects %s', (csp, word) => {
    const problems = checkHeaders(headers(csp));
    expect(problems.join('\n')).toContain(word);
  });

  it('allows inlined images, which Vite produces for small files', () => {
    expect(checkHeaders(headers(`${GOOD_CSP}; img-src 'self' data:`))).toEqual([]);
    expect(checkHeaders(headers(`${GOOD_CSP}; script-src 'self' data:`))).not.toEqual([]);
  });

  it('rejects a later rule that removes or replaces the policy', () => {
    expect(checkHeaders(headers(GOOD_CSP, '/x\n  ! Content-Security-Policy'))).not.toEqual([]);
    expect(
      checkHeaders(headers(GOOD_CSP, '/x\n  Content-Security-Policy: default-src *')),
    ).not.toEqual([]);
  });
});

describe('checkWrangler', () => {
  it('accepts the expected configuration, with comments', () => {
    expect(checkWrangler(wrangler())).toEqual([]);
    expect(checkWrangler(`// why\n${wrangler()}`)).toEqual([]);
  });

  it.each([
    [{ name: 'other' }, 'name'],
    [{ assets: { directory: './public', not_found_handling: 'single-page-application' } }, 'dist'],
    [{ assets: { directory: './dist' } }, 'not_found_handling'],
    [{ assets: null }, 'assets'],
    [{ compatibility_date: 'today' }, 'compatibility_date'],
    [{ compatibility_date: '2999-01-01' }, 'compatibility_date'],
    [{ main: 'src/worker.ts' }, 'main'],
    [{ previews: undefined }, 'previews'],
    [{ account_id: 'abc' }, 'account_id'],
    [{ workers_dev: false }, 'workers_dev'],
    [{ workers_dev: undefined }, 'workers_dev'],
    [{ preview_urls: false }, 'preview_urls'],
    [{ preview_urls: undefined }, 'preview_urls'],
  ])('rejects %j', (patch, word) => {
    expect(checkWrangler(wrangler(patch)).join('\n')).toContain(word);
  });

  it('reports broken input instead of throwing', () => {
    expect(checkWrangler('')).toHaveLength(1);
    expect(checkWrangler('{ nope')).toHaveLength(1);
    expect(checkWrangler('[]')).toHaveLength(1);
    expect(checkWrangler('null')).toHaveLength(1);
  });
});

describe('checkIndexHtml', () => {
  it('rejects inline scripts, inline styles and handlers', () => {
    expect(checkIndexHtml('<script type="module" src="/src/main.ts"></script>')).toEqual([]);
    expect(checkIndexHtml('<script>alert(1)</script>')).toHaveLength(1);
    expect(checkIndexHtml('<style>body{}</style>')).toHaveLength(1);
    expect(checkIndexHtml('<body style="margin:0">')).toHaveLength(1);
    expect(checkIndexHtml('<body onload="go()">')).toHaveLength(1);
  });
});

describe('checkCi', () => {
  it('accepts the expected workflow', () => {
    expect(checkCi(CI)).toEqual([]);
  });

  it.each([
    [CI.replace('  pull_request:\n', ''), 'pull_request'],
    [CI.replace('  pull_request:', '  pull_request_target:'), 'pull_request'],
    [CI.replace('branches: [main]', 'branches: [dev]'), 'main'],
    [CI.replace('contents: read', 'contents: write'), 'permissions'],
    [CI.replace('cancel-in-progress: true', 'cancel-in-progress: false'), 'concurrency'],
    [CI.replace('npm run gate', 'npm test'), 'npm run gate'],
    [CI.replace('npm ci', 'npm install'), 'npm ci'],
    [`${CI}\n        env:\n          T: \${{ secrets.CLOUDFLARE_API_TOKEN }}`, 'secrets'],
    ['', 'pull_request'],
  ])('rejects a workflow that drifts (%#)', (text, word) => {
    expect(checkCi(text).join('\n')).toContain(word);
  });
});

// Holes found by the verifier: each of these passed the first version of the checks.
describe('guard holes', () => {
  it.each([
    ['a second /* block that detaches the policy', '/*\n  ! Content-Security-Policy'],
    ['a second /* block with another policy', '/*\n  Content-Security-Policy: default-src *'],
    ['a host rule that detaches the policy', 'https://example.com/*\n  ! Content-Security-Policy'],
    ['a second /* block that changes nosniff', '/*\n  X-Content-Type-Options: sniff'],
  ])('headers: rejects %s', (_, extra) => {
    expect(checkHeaders(headers(GOOD_CSP, extra))).not.toEqual([]);
  });

  it('headers: rejects a second policy line inside the same block', () => {
    const twice = headers(GOOD_CSP, '  Content-Security-Policy: default-src *');
    expect(checkHeaders(twice).join('\n')).toContain('another server');
  });

  it.each([null, undefined, 42, {}])('headers: reports %j instead of throwing', (input) => {
    expect(checkHeaders(input)).toEqual(['_headers must be text']);
  });

  it.each([
    ["secrets['X'] form", `${CI}\n        env:\n          T: \${{ secrets['X'] }}`, 'secrets'],
    ['secrets with spaces', `${CI}\n        env:\n          T: \${{ secrets [ 'X' ] }}`, 'secrets'],
    [
      'job-level write permission',
      CI.replace('  gate:\n', '  gate:\n    permissions:\n      contents: write\n'),
      'permissions',
    ],
    [
      'job-level write-all',
      CI.replace('  gate:\n', '  gate:\n    permissions: write-all\n'),
      'permissions',
    ],
    [
      'a wrangler step',
      `${CI}\n      - run: ./node_modules/.bin/wrangler versions upload`,
      'deploy',
    ],
    ['a deploy script', `${CI}\n      - run: npm run deploy`, 'deploy'],
    ['a Cloudflare action', `${CI}\n      - uses: cloudflare/wrangler-action@v3`, 'deploy'],
  ])('workflow: rejects %s', (_, text, word) => {
    expect(checkCi(text).join('\n')).toContain(word);
  });

  it('workflow: allows read-only job permissions and comments about deploys', () => {
    const job = CI.replace('  gate:\n', '  gate:\n    permissions:\n      contents: read\n');
    expect(checkCi(`# Cloudflare deploys by itself\n${job}`)).toEqual([]);
  });

  it.each([
    [{ routes: [{ pattern: 'hacks.antipic.com', custom_domain: true }] }, 'routes'],
    [{ route: 'hacks.antipic.com/*' }, 'route'],
    [{ env: { staging: {} } }, 'env'],
    [{ previews: [] }, 'previews'],
    [{ previews: 'yes' }, 'previews'],
    [{ vars: { A: '1' } }, 'vars'],
    [{ triggers: { crons: ['* * * * *'] } }, 'triggers'],
    [
      {
        assets: {
          directory: './dist',
          not_found_handling: 'single-page-application',
          run_worker_first: true,
        },
      },
      'run_worker_first',
    ],
  ])('wrangler: rejects %j', (patch, word) => {
    expect(checkWrangler(wrangler(patch)).join('\n')).toContain(word);
  });

  it.each([
    '<script src="https://cdn.example.com/x.js"></script>',
    '<script src="//cdn.example.com/x.js"></script>',
    '<link rel="stylesheet" href="https://fonts.example.com/css" />',
    "<link rel=preconnect href='http://example.com'>",
    '<img src=https://example.com/a.png>',
  ])('page: rejects %s', (html) => {
    expect(checkIndexHtml(html).join('\n')).toContain('another server');
  });

  it('page: allows files of this site', () => {
    expect(checkIndexHtml('<link rel="icon" href="/favicon.svg" />')).toEqual([]);
    expect(checkIndexHtml('<script type="module" src="./src/main.ts"></script>')).toEqual([]);
  });
});
