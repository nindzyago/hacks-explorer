// Size budgets (plan/architecture.md §6): the check measures what index.html loads and every
// lesson file, and names each broken budget.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CARD_FILE,
  FIRST_LOAD_JS_GZIP,
  GLOSSARY_FILE,
  TOPICS_FILE,
  LESSON_FILE,
  firstLoadScripts,
  measure,
} from './budget.mjs';

const work = mkdtempSync(join(tmpdir(), 'budget-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function site(name, { js = 'console.log(1)', lesson = '{}', catalog = true } = {}) {
  const dir = join(work, name);
  mkdirSync(join(dir, 'assets'), { recursive: true });
  mkdirSync(join(dir, 'data', 'lessons'), { recursive: true });
  writeFileSync(
    join(dir, 'index.html'),
    '<script type="module" crossorigin src="/assets/a.js"></script><link rel="modulepreload" crossorigin href="/assets/b.js">',
  );
  writeFileSync(join(dir, 'assets', 'a.js'), js);
  writeFileSync(join(dir, 'assets', 'b.js'), 'export {}');
  writeFileSync(join(dir, 'data', 'lessons', 'B1.ru.0123abcd.json'), lesson);
  if (catalog) writeFileSync(join(dir, 'data', 'catalog.json'), '{}');
  return dir;
}

describe('firstLoadScripts', () => {
  it('finds scripts and module preloads, once each, not other servers', () => {
    expect(
      firstLoadScripts(
        '<script src="/a.js"></script><script src="https://x.example/c.js"></script><link rel="modulepreload" href="./b.js"><script src="/a.js"></script>',
      ),
    ).toEqual(['a.js', 'b.js']);
  });
});

describe('measure', () => {
  it('passes a small site and gives the numbers', () => {
    const result = measure(site('small'));
    expect(result.problems).toEqual([]);
    expect(result.firstLoad.files.map((f) => f.path)).toEqual(['assets/a.js', 'assets/b.js']);
    expect(result.firstLoad.gzip).toBeGreaterThan(0);
    expect(result.lessons).toEqual([{ path: 'data/lessons/B1.ru.0123abcd.json', bytes: 2 }]);
  });

  it('fails a first load over 150 KB of gzip', () => {
    // Random bytes do not compress.
    const js = randomBytes(FIRST_LOAD_JS_GZIP).toString('base64');
    const { problems } = measure(site('heavy', { js }));
    expect(problems.join('\n')).toMatch(
      /^first load: \d+ bytes of JS in gzip; the budget is 153600$/,
    );
  });

  it('fails a lesson file over 30 KB', () => {
    const { problems } = measure(site('big-lesson', { lesson: 'x'.repeat(LESSON_FILE + 1) }));
    expect(problems).toEqual([
      'data/lessons/B1.ru.0123abcd.json: 30721 bytes; a lesson file is at most 30720',
    ]);
  });

  it('measures the glossary files and fails one over 30 KB (M2.4)', () => {
    const dir = site('glossary');
    mkdirSync(join(dir, 'data', 'glossary'), { recursive: true });
    writeFileSync(join(dir, 'data', 'glossary', 'ru.json'), '{}');
    expect(measure(dir).glossaries).toEqual([{ path: 'data/glossary/ru.json', bytes: 2 }]);
    writeFileSync(join(dir, 'data', 'glossary', 'ru.json'), 'x'.repeat(GLOSSARY_FILE + 1));
    expect(measure(dir).problems).toEqual([
      'data/glossary/ru.json: 30721 bytes; a glossary file is at most 30720',
    ]);
  });
  it('measures the topics files and fails one over 30 KB (M2.1b)', () => {
    const dir = site('topics');
    mkdirSync(join(dir, 'data', 'topics'), { recursive: true });
    writeFileSync(join(dir, 'data', 'topics', 'ru.json'), '{}');
    expect(measure(dir).topics).toEqual([{ path: 'data/topics/ru.json', bytes: 2 }]);
    writeFileSync(join(dir, 'data', 'topics', 'ru.json'), 'x'.repeat(TOPICS_FILE + 1));
    expect(measure(dir).problems).toEqual([
      'data/topics/ru.json: 30721 bytes; a topics file is at most 30720',
    ]);
  });

  it('measures the social cards and fails one over 100 KB (M4.3)', () => {
    const dir = site('cards');
    mkdirSync(join(dir, 'cards'), { recursive: true });
    writeFileSync(join(dir, 'cards', 'B1.ru.png'), 'png');
    expect(measure(dir).cards).toEqual([{ path: 'cards/B1.ru.png', bytes: 3 }]);
    writeFileSync(join(dir, 'cards', 'B1.ru.png'), 'x'.repeat(CARD_FILE + 1));
    expect(measure(dir).problems).toEqual([
      'cards/B1.ru.png: 102401 bytes; a social card is at most 102400',
    ]);
  });

  it('fails without a build, a catalog or a script file', () => {
    expect(measure(join(work, 'nothing')).problems[0]).toMatch(/build the site first/);
    expect(measure(site('no-catalog', { catalog: false })).problems[0]).toMatch(/no catalog/);
    const dir = site('no-script');
    rmSync(join(dir, 'assets', 'b.js'));
    expect(measure(dir).problems[0]).toMatch(/loads assets\/b\.js, which is not in/);
  });
});
