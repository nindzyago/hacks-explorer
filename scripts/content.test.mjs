// The content gate (design M1.1 E11, scenario S8): every file under content/lessons passes the
// lesson checker. Runs in `npm run gate` and alone as `npm run content`.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkContent, formatError } from '../src/core/lesson/check';
import { ROOT, readContent } from './content-files.mjs';

describe('content', () => {
  const { lessons, sources } = readContent();
  const result = checkContent(lessons, sources);

  it('has lessons, the first being B1', () => {
    expect(lessons.map((f) => f.path)).toContain('content/lessons/B1/ru.md');
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
    expect(icons.size).toBe(8);
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
    });
    rmSync(empty, { recursive: true, force: true });
  });
});
