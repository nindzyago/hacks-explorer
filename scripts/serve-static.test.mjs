// The e2e server must behave like the production host for the things that can break a reader's
// page: the `_headers` file (CSP), the fallback to index.html, and nothing outside the folder.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticServer, headersFor, parseHeadersFile } from './serve-static.mjs';

const HEADERS = `# comment
/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data:
  X-Content-Type-Options: nosniff

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

describe('parseHeadersFile', () => {
  it('reads paths and their headers', () => {
    expect(parseHeadersFile(HEADERS)).toEqual([
      {
        pattern: '/*',
        headers: [
          ['Content-Security-Policy', "default-src 'self'; img-src 'self' data:"],
          ['X-Content-Type-Options', 'nosniff'],
        ],
      },
      {
        pattern: '/assets/*',
        headers: [['Cache-Control', 'public, max-age=31536000, immutable']],
      },
    ]);
  });

  it('does not crash on empty or malformed text', () => {
    expect(parseHeadersFile('')).toEqual([]);
    expect(
      parseHeadersFile('  Orphan: header\n\n:::\n/a\n  no colon here\n  : empty name\n'),
    ).toEqual([{ pattern: '/a', headers: [] }]);
    expect(parseHeadersFile('/*\r\n  X-A: 1\r\n')).toEqual([
      { pattern: '/*', headers: [['X-A', '1']] },
    ]);
  });
});

describe('headersFor', () => {
  const rules = parseHeadersFile(HEADERS);

  it('applies every rule whose pattern matches the path', () => {
    expect(Object.keys(headersFor(rules, '/'))).toEqual([
      'Content-Security-Policy',
      'X-Content-Type-Options',
    ]);
    expect(headersFor(rules, '/assets/index-abc.js')['Cache-Control']).toContain('immutable');
    expect(headersFor(rules, '/assets')['Cache-Control']).toBeUndefined();
    expect(headersFor(rules, '/ru/lesson/B1')['Cache-Control']).toBeUndefined();
  });

  it('treats a pattern as text, not as a regular expression', () => {
    const exact = parseHeadersFile('/a.b\n  X-A: 1\n');
    expect(headersFor(exact, '/a.b')).toEqual({ 'X-A': '1' });
    expect(headersFor(exact, '/axb')).toEqual({});
  });

  it('joins a header repeated across rules, as the production host does', () => {
    const twice = parseHeadersFile('/*\n  X-A: 1\n/b\n  X-A: 2\n');
    expect(headersFor(twice, '/b')).toEqual({ 'X-A': '1, 2' });
  });
});

describe('createStaticServer', () => {
  let root = '';
  let bare = '';
  let outside = '';
  /** @type {import('node:http').Server[]} */
  const servers = [];

  /** @returns {Promise<string>} */
  const start = (dir) =>
    new Promise((resolve) => {
      const server = createStaticServer(dir);
      servers.push(server);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') throw new Error('no port');
        resolve(`http://127.0.0.1:${String(address.port)}`);
      });
    });

  /** A raw request: `fetch` would normalise `..` away before it reaches the server. */
  const raw = (origin, path, method = 'GET') =>
    new Promise((resolve, reject) => {
      const { hostname, port } = new URL(origin);
      const req = request({ hostname, port, path, method }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });

  beforeAll(() => {
    const base = mkdtempSync(join(tmpdir(), 'serve-static-'));
    root = join(base, 'site');
    bare = join(base, 'bare');
    outside = base;
    mkdirSync(join(root, 'assets'), { recursive: true });
    mkdirSync(bare);
    writeFileSync(join(base, 'secret.txt'), 'SECRET');
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>home</title>');
    writeFileSync(join(root, 'assets', 'app.js'), 'export {};');
    writeFileSync(join(root, 'assets', 'app.css'), 'main{}');
    mkdirSync(join(root, 'ru', 'lesson'), { recursive: true });
    writeFileSync(join(root, 'ru', 'lesson', 'K1.html'), '<!doctype html><title>K1</title>');
    writeFileSync(join(root, '_headers'), HEADERS);
    writeFileSync(join(bare, 'index.html'), '<!doctype html><title>bare</title>');
  });

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
    rmSync(outside, { recursive: true, force: true });
  });

  it('serves files with their type and the headers from _headers', async () => {
    const origin = await start(root);
    const home = await raw(origin, '/');
    expect(home.status).toBe(200);
    expect(home.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(home.headers['content-security-policy']).toBe(
      "default-src 'self'; img-src 'self' data:",
    );
    expect(home.body).toContain('<title>home</title>');

    const script = await raw(origin, '/assets/app.js?v=1');
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(script.headers['cache-control']).toContain('immutable');
    expect(script.headers['x-content-type-options']).toBe('nosniff');
    expect(script.body).toBe('export {};');

    const style = await raw(origin, '/assets/app.css');
    expect(style.headers['content-type']).toBe('text/css; charset=utf-8');
  });

  it('falls back to index.html for unknown paths, with the headers of that path', async () => {
    const origin = await start(root);
    for (const path of ['/ru/lesson/B1', '/assets/missing.js', '/assets', '/%E0%A4%A']) {
      const page = await raw(origin, path);
      expect(page.status, path).toBe(200);
      expect(page.body, path).toContain('<title>home</title>');
      expect(page.headers['content-security-policy'], path).toBeDefined();
    }
  });

  // M4.3: Cloudflare's html_handling "auto-trailing-slash" serves /ru/lesson/K1 from K1.html.
  it('serves the static page of an address from <path>.html, with the headers of that path', async () => {
    const origin = await start(root);
    const page = await raw(origin, '/ru/lesson/K1');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(page.body).toContain('<title>K1</title>');
    expect(page.headers['content-security-policy']).toBeDefined();
    // Another lesson, a near miss, or a path that escapes still get index.html.
    for (const path of ['/ru/lesson/K2', '/ru/lesson/K1/', '/ru/lesson/..%2FK1', '/ru/lesson']) {
      expect((await raw(origin, path)).body, path).toContain('<title>home</title>');
    }
  });

  it('serves without extra headers when there is no _headers file', async () => {
    const origin = await start(bare);
    const home = await raw(origin, '/');
    expect(home.status).toBe(200);
    expect(home.body).toContain('<title>bare</title>');
    expect(home.headers['content-security-policy']).toBeUndefined();
  });

  it('never serves anything outside its folder, nor the _headers file itself', async () => {
    const origin = await start(root);
    for (const path of [
      '/../secret.txt',
      '/assets/../../secret.txt',
      '/..%2Fsecret.txt',
      '/%2e%2e/secret.txt',
      '/..\\secret.txt',
      '//secret.txt',
      '/_headers',
    ]) {
      const answer = await raw(origin, path);
      expect(answer.body, path).not.toContain('SECRET');
      expect(answer.body, path).not.toContain('Content-Security-Policy');
      expect(answer.body, path).toContain('<title>home</title>');
    }
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const origin = await start(root);
    const head = await raw(origin, '/', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
    const post = await raw(origin, '/', 'POST');
    expect(post.status).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');
  });

  it('says so when the folder has no index.html', async () => {
    const origin = await start(join(outside, 'no-such-folder'));
    const answer = await raw(origin, '/');
    expect(answer.status).toBe(404);
  });
});
