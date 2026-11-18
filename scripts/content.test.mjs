// The content gate (design M1.1 E11, scenario S8): every file under content/lessons passes the
// lesson checker. Runs in `npm run gate` and alone as `npm run content`.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkContent, formatError } from '../src/core/lesson/check';
import { readContent } from './content-files.mjs';

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
