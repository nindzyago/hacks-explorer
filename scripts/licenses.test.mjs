// Acceptance for M4.4 (law L1): every dependency has a licence from the list or a written
// exception, and every asset in the repository is in ATTRIBUTION.md with a source.
// Oracle level A: exact values.
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXCEPTIONS,
  allowedExpression,
  checkPackages,
  checkProject,
  declaredLicense,
  installedPackages,
  lockedPackages,
} from './licenses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('licence expressions', () => {
  it.each([
    'MIT',
    'Apache-2.0',
    'ISC',
    'Zlib',
    'MPL-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    '(MIT OR Apache-2.0)',
    'MIT OR GPL-3.0-only',
    'MIT AND ISC',
    '(MIT AND Zlib) OR LGPL-3.0-or-later',
  ])('allows %s', (expression) => {
    expect(allowedExpression(expression)).toBe(true);
  });

  it.each([
    'GPL-3.0-only',
    'LGPL-3.0-or-later',
    'CC0-1.0',
    'CC-BY-4.0',
    'BlueOak-1.0.0',
    '0BSD',
    'BSD',
    'MIT AND GPL-2.0-only',
    'Apache-2.0 WITH LLVM-exception',
    'SEE LICENSE IN LICENSE.md',
    'UNLICENSED',
    'mit',
    '(MIT',
    'MIT)',
    'MIT OR',
    'OR MIT',
    '()',
    '',
    '   ',
  ])('refuses %j', (expression) => {
    expect(allowedExpression(expression)).toBe(false);
  });

  it.each([null, undefined, 42, {}, ['MIT']])('refuses a non-string %j', (value) => {
    expect(allowedExpression(value)).toBe(false);
  });
});

describe('the licence a package.json declares', () => {
  it('reads license, the old licenses array and the old object form', () => {
    expect(declaredLicense({ license: 'MIT' })).toBe('MIT');
    expect(declaredLicense({ license: { type: 'ISC' } })).toBe('ISC');
    expect(declaredLicense({ licenses: [{ type: 'MIT' }] })).toBe('MIT');
    expect(declaredLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      '(MIT) OR (Apache-2.0)',
    );
  });

  it('gives null for anything it cannot read', () => {
    for (const manifest of [
      null,
      'MIT',
      42,
      {},
      { license: '' },
      { license: 7 },
      { licenses: [] },
    ]) {
      expect(declaredLicense(manifest)).toBeNull();
    }
    expect(declaredLicense({ licenses: [{ type: 'MIT' }, 'junk'] })).toBe('(MIT) OR (junk)');
    expect(declaredLicense({ licenses: [{ type: 'MIT' }, 5] })).toBeNull();
  });
});

describe('the package check', () => {
  const pkg = (name, license) => ({ name, license, where: `node_modules/${name}` });

  it('passes allowed licences and listed exceptions', () => {
    expect(checkPackages([pkg('a', 'MIT'), pkg('minimatch', 'BlueOak-1.0.0')])).toEqual([]);
  });

  it('names a package with a licence outside the list', () => {
    const problems = checkPackages([pkg('sharp-libvips', 'LGPL-3.0-or-later')]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('sharp-libvips');
    expect(problems[0]).toContain('LGPL-3.0-or-later');
  });

  it('names a package without a licence', () => {
    expect(checkPackages([pkg('nameless', null)])[0]).toContain('not declared');
  });

  it('does not stretch an exception to another package or another licence', () => {
    expect(checkPackages([pkg('other', 'BlueOak-1.0.0')])).toHaveLength(1);
    expect(checkPackages([pkg('minimatch', 'GPL-3.0-only')])).toHaveLength(1);
  });

  it('gives every exception a reason', () => {
    for (const exception of EXCEPTIONS) {
      expect(allowedExpression(exception.license)).toBe(false);
      expect(exception.reason.length).toBeGreaterThan(40);
    }
  });
});

describe('reading a project', () => {
  it('finds nested and scoped packages and survives a broken package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'licenses-'));
    const write = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    write('node_modules/a/package.json', JSON.stringify({ name: 'a', license: 'MIT' }));
    write(
      'node_modules/a/node_modules/b/package.json',
      JSON.stringify({ name: 'b', license: 'GPL-3.0' }),
    );
    write('node_modules/@s/c/package.json', JSON.stringify({ name: '@s/c', license: 'ISC' }));
    write('node_modules/broken/package.json', '{ not json');
    write('node_modules/.bin/x', '');
    const found = installedPackages(root);
    expect(found.map((p) => p.name).sort()).toEqual(['@s/c', 'a', 'b', 'node_modules/broken']);
    expect(checkPackages(found).map((line) => line.split(' ')[0])).toEqual([
      'b',
      'node_modules/broken',
    ]);
  });

  it('reads every package of the lockfile and refuses a lockfile it cannot read', () => {
    const lock = {
      packages: {
        '': { name: 'root' },
        'node_modules/x': { license: 'MIT' },
        'node_modules/x/node_modules/@y/z': { license: 'CC0-1.0' },
        'node_modules/linked': { link: true },
      },
    };
    expect(lockedPackages(lock).map((p) => [p.name, p.license])).toEqual([
      ['x', 'MIT'],
      ['@y/z', 'CC0-1.0'],
    ]);
    expect(() => lockedPackages({ dependencies: {} })).toThrow(/lockfileVersion/);
    expect(() => lockedPackages(null)).toThrow();
  });
});

describe('the repository as installed', () => {
  it('has only dependencies with L1 licences or written exceptions', () => {
    const { problems, count } = checkProject(ROOT);
    expect(count).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });

  it('lists every exception in ATTRIBUTION.md', () => {
    const attribution = readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8');
    for (const { name, license } of EXCEPTIONS) {
      expect(attribution).toContain(`\`${name}\``);
      expect(attribution).toContain(license);
    }
  });
});

// Every asset has a source (L1). An asset is any file in public/ except _headers, and any image,
// font, sound or video anywhere in the repository; content/lessons Markdown is not an asset.
describe('ATTRIBUTION.md', () => {
  const attribution = readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8');
  const SKIP = new Set(['node_modules', 'dist', 'dist-e2e', 'reference', 'test-results']);
  const MEDIA = /\.(png|jpe?g|webp|gif|avif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|webm)$/i;
  /** @param {string} dir @returns {string[]} */
  const files = (dir) =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      if (entry.name.startsWith('.') || SKIP.has(entry.name)) return [];
      const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
      return entry.isDirectory() ? files(path) : [path];
    });
  const assets = files('').filter(
    (path) => MEDIA.test(path) || (path.startsWith('public/') && path !== 'public/_headers'),
  );

  /** Rows of every asset table (first column «Файл»), keyed by the header. */
  const rows = [];
  let header = null;
  for (const line of attribution.split('\n')) {
    if (!line.startsWith('|')) {
      header = null;
      continue;
    }
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((cell) => cell.trim());
    if (header === null) header = cells;
    else if (header[0] === 'Файл' && /^`[^`]+`$/.test(cells[0] ?? '')) {
      rows.push(Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])));
    }
  }
  const pathOf = (row) => String(Object.values(row)[0]).slice(1, -1);

  it('finds the assets it should', () => {
    expect(assets).toContain('content/icons/attacker.webp');
    expect(assets).toContain('public/fonts/OFL-onest.txt');
    expect(assets).toContain('prototype/assets/sheet-a.jpg');
  });

  it('has a table row for every asset', () => {
    const listed = new Set(rows.map(pathOf));
    expect(assets.filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists no file that is not there', () => {
    expect(rows.map(pathOf).filter((path) => !existsSync(join(ROOT, path)))).toEqual([]);
  });

  it('gives every row a source', () => {
    const missing = rows.filter((row) => {
      const source = row['Источник'] ?? row['Лист'] ?? '';
      return source === '' || source === '—';
    });
    expect(missing.map(pathOf)).toEqual([]);
  });

  it('cuts every icon from a sheet that is in the repository', () => {
    const icons = rows.filter((row) => pathOf(row).startsWith('content/icons/'));
    expect(icons.length).toBeGreaterThan(0);
    for (const row of icons) {
      expect(
        existsSync(join(ROOT, 'prototype/assets', `sheet-${row['Лист'].toLowerCase()}.jpg`)),
      ).toBe(true);
    }
  });

  it('has every font under SIL OFL', () => {
    const fonts = rows.filter((row) => /\.(woff2?|ttf|otf)$/.test(pathOf(row)));
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.filter((row) => !/^SIL OFL\b/.test(row['Лицензия'] ?? '')).map(pathOf)).toEqual(
      [],
    );
  });
});
