// The content gate (design M1.1 E11, scenario S8): every file under content/lessons passes the
// lesson checker. Runs in `npm run gate` and alone as `npm run content`.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkGlossaries } from '../src/core/glossary/check';
import { checkContent, formatError } from '../src/core/lesson/check';
import { unknownId } from '../src/core/lesson/ids';
import { checkCatalogs } from '../src/core/topics/check';
import { ROOT, readContent } from './content-files.mjs';

describe('content', () => {
  const { lessons, sources } = readContent();
  const result = checkContent(lessons, sources);

  it('has lessons, the first being B1', () => {
    expect(lessons.map((f) => f.path)).toContain('content/lessons/B1/ru.md');
  });

  // M2.4 (K98): the glossary of every lesson language passes its checker, and the lessons'
  // `term:` words name its terms.
  it('has a Russian glossary that passes the glossary checker', () => {
    const { glossaries } = readContent();
    expect(glossaries.map((f) => f.path)).toContain('content/locales/ru/glossary.md');
    const checked = checkGlossaries(glossaries, {
      lessons: result.lessons,
      lessonPaths: lessons.map((f) => f.path),
    });
    expect(checked.errors.map(formatError).join('\n')).toBe('');
    expect(checked.glossaries[0]?.terms.length).toBeGreaterThanOrEqual(25);
  });

  // M2.1b (K112): the catalog of every language lists every topic; every lesson is in it.
  it('has catalogs of topics that pass the catalog checker', () => {
    const { catalogs } = readContent();
    expect(catalogs.map((f) => f.path).sort()).toEqual([
      'content/locales/en/catalog.md',
      'content/locales/ru/catalog.md',
    ]);
    const checked = checkCatalogs(catalogs, {
      lessons: result.lessons,
      lessonPaths: lessons.map((f) => f.path),
      siteLanguages: ['ru', 'en'],
    });
    expect(checked.errors.map(formatError).join('\n')).toBe('');
  });

  it('passes the lesson checker', () => {
    // A failure lists `file:line:column: message`, one per line.
    expect(result.errors.map(formatError).join('\n')).toBe('');
    expect(result.lessons.length).toBe(lessons.length);
  });

  // M1.2a: an icon a lesson names must exist, so a typo stops the gate and not the reader
  // (L0.1). The site still draws a placeholder for a name it does not know.
  it('names only icons that are in content/icons', () => {
    const icons = new Set(
      readdirSync(join(ROOT, 'content', 'icons'))
        .filter((name) => name.endsWith('.webp'))
        .map((name) => name.slice(0, -'.webp'.length)),
    );
    expect(icons.size).toBe(14);
    const missing = result.lessons.flatMap((lesson) => [
      ...lesson.participants
        .filter((p) => !icons.has(p.icon))
        .map((p) => `${lesson.id}: participant ${p.id} has no icon ${p.icon}`),
      ...lesson.steps
        .filter((s) => s.icon !== null && !icons.has(s.icon))
        .map((s) => `${lesson.id}: step ${s.id} has no icon ${String(s.icon)}`),
    ]);
    expect(missing).toEqual([]);
  });

  it('lists every icon and font in ATTRIBUTION.md (L1)', () => {
    const attribution = readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8');
    const assets = [
      ...readdirSync(join(ROOT, 'content', 'icons')).map((name) => `content/icons/${name}`),
      ...readdirSync(join(ROOT, 'public', 'fonts')).map((name) => `public/fonts/${name}`),
    ];
    expect(assets.filter((path) => !attribution.includes(`\`${path}\``))).toEqual([]);
  });
});

// M2.8: every CWE, ATT&CK technique and CVE the catalog plans is in the vetted lists, so a
// lesson author is never stopped by a missing entry and a new catalog id is vetted first (L5).
describe('the catalog ids are vetted', () => {
  const catalog = readFileSync(join(ROOT, 'plan', 'content-catalog.md'), 'utf8');
  const ids = (re) => [...new Set([...catalog.matchAll(re)].map((m) => m[1]))];

  it('lists every CWE of plan/content-catalog.md', () => {
    const cwe = ids(/CWE-(\d+)/g);
    expect(cwe.length).toBeGreaterThan(20);
    expect(cwe.filter((n) => unknownId('cwe', n) !== null)).toEqual([]);
  });

  it('lists every ATT&CK technique of plan/content-catalog.md', () => {
    const attack = ids(/ATT&CK (T\d{4}(?:\.\d{3})?)/g);
    expect(attack.length).toBeGreaterThan(8);
    expect(attack.filter((t) => unknownId('attack', t) !== null)).toEqual([]);
  });

  // A tactic (TA0011) is not a technique: the passport word `attack` cannot hold it. Not a
  // failure, so a plan edit does not stop the gate; the warning names the row to fix.
  it('warns about ATT&CK tactics in plan/content-catalog.md', () => {
    const rows = catalog
      .split('\n')
      .filter((line) => /ATT&CK TA\d{4}/.test(line))
      .map((line) => line.split('|')[1]?.trim() ?? line);
    if (rows.length > 0) {
      // Straight to stderr: vitest hides console output of passing tests.
      process.stderr.write(
        `\nwarning: plan/content-catalog.md names ATT&CK tactics, not techniques, in rows: ${rows.join(', ')}; ` +
          'a passport `attack` holds only techniques (T1071), see src/core/lesson/README.md\n',
      );
    }
    expect(rows.every((row) => /^[A-L]\d{1,2}$/.test(row))).toBe(true);
  });

  it('lists every CVE of plan/content-catalog.md', () => {
    const cves = ids(/(CVE-\d{4}-\d{4,7})/g);
    expect(cves.length).toBe(6);
    expect(cves.filter((c) => unknownId('cves', c) !== null)).toEqual([]);
  });
});

describe('readContent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('finds every file under content/lessons and reports a broken one', () => {
    mkdirSync(join(dir, 'content', 'lessons', 'Z1'), { recursive: true });
    writeFileSync(join(dir, 'content', 'lessons', 'Z1', 'ru.md'), '# Z\n');
    writeFileSync(join(dir, 'content', 'lessons', 'Z1', 'draft.txt'), 'x');
    writeFileSync(join(dir, 'content', 'sources.md'), '- `owasp.org` OWASP\n');
    const { lessons, sources } = readContent(dir);
    expect(lessons.map((f) => f.path)).toEqual([
      'content/lessons/Z1/draft.txt',
      'content/lessons/Z1/ru.md',
    ]);
    const lines = checkContent(lessons, sources).errors.map(formatError);
    expect(lines[0]).toBe(
      'content/lessons/Z1/draft.txt:1:1: content/lessons/<id>/ holds only <language>.md files',
    );
    expect(lines.some((l) => l.startsWith('content/lessons/Z1/ru.md:'))).toBe(true);
  });

  it('works without content at all', () => {
    const empty = mkdtempSync(join(tmpdir(), 'content-empty-'));
    expect(readContent(empty)).toEqual({
      lessons: [],
      sources: { path: 'content/sources.md', text: '' },
      glossaries: [],
      ui: [],
      languages: null,
      catalogs: [],
    });
    rmSync(empty, { recursive: true, force: true });
  });
});
