// M4.2, oracle level D (scenarios S5, S9; decisions K94, K105, K106): a new site language is
// added the way docs/new-language.md says, and nothing else changes. The test makes a fictional
// language `xx` in a copy of the real content: one folder content/locales/xx/ (interface strings,
// glossary, catalog), an xx.md next to every lesson and one line in content/locales/languages.md.
// The two word tables of the checkers (src/core/lesson/headings.ts, src/core/glossary/words.ts)
// get their one entry through a mock, because a real entry would put a fake language into the
// product; with the entry switched off the gate names both tables.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ROOT, readContent } from './content-files.mjs';
import { buildLessonData, lessonData } from './lesson-data';

const CODE = 'xx';
const NAME = 'Testish';
const tables = vi.hoisted(() => ({ withEntry: true }));

// The one entry per table that a new language adds; it copies the English words.
vi.mock('../src/core/lesson/headings', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/core/lesson/headings')>();
  return {
    ...real,
    wordsFor: (language: string) =>
      language === CODE && tables.withEntry ? real.wordsFor('en') : real.wordsFor(language),
    knownLanguages: () =>
      tables.withEntry ? [...real.knownLanguages(), CODE] : real.knownLanguages(),
  };
});
vi.mock('../src/core/glossary/words', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/core/glossary/words')>();
  return {
    ...real,
    glossaryWordsFor: (language: string) =>
      language === CODE && tables.withEntry
        ? real.glossaryWordsFor('en')
        : real.glossaryWordsFor(language),
    glossaryLanguages: () =>
      tables.withEntry ? [...real.glossaryLanguages(), CODE] : real.glossaryLanguages(),
  };
});

const work = mkdtempSync(join(tmpdir(), 'new-language-'));
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

interface Steps {
  /** Step 2: content/locales/xx/ with ui.md, glossary.md and catalog.md. */
  readonly folder: boolean;
  /** Step 3: xx.md in every lesson folder (all but `skip`). */
  readonly lessons: boolean;
  readonly skip?: string;
  /** Step 4: the line in content/locales/languages.md. */
  readonly listed: boolean;
}

/** A copy of the real content with the steps of docs/new-language.md done. */
function project(name: string, steps: Steps): string {
  const root = join(work, name);
  cpSync(join(ROOT, 'content'), join(root, 'content'), { recursive: true });
  const locales = join(root, 'content', 'locales');
  if (steps.folder) {
    mkdirSync(join(locales, CODE));
    for (const [file, word] of [
      ['ui.md', 'ui'],
      ['glossary.md', 'glossary'],
      ['catalog.md', 'catalog'],
    ] as const) {
      const en = readFileSync(join(locales, 'en', file), 'utf8');
      const header = `\`${word}\` en · \`format\` 1`;
      expect(en).toContain(header);
      writeFileSync(
        join(locales, CODE, file),
        en.replace(header, `\`${word}\` ${CODE} · \`format\` 1`),
      );
    }
  }
  if (steps.lessons) {
    const lessons = join(root, 'content', 'lessons');
    for (const id of readdirSync(lessons)) {
      if (id === steps.skip) continue;
      cpSync(join(lessons, id, 'en.md'), join(lessons, id, `${CODE}.md`));
    }
  }
  if (steps.listed) {
    const path = join(locales, 'languages.md');
    writeFileSync(path, `${readFileSync(path, 'utf8')}- \`${CODE}\` ${NAME}\n`);
  }
  return root;
}

const all: Steps = { folder: true, lessons: true, listed: true };

describe('adding a site language (M4.2, K94)', () => {
  it('a test language added as one locale folder, its lessons and one line passes K94', () => {
    tables.withEntry = true;
    const result = buildLessonData(readContent(project('complete', all)));
    expect(result.ok ? '' : result.errors.join('\n')).toBe('');
    if (!result.ok) return;
    expect(result.locales.languages.map((l) => l.code)).toEqual(['ru', 'en', CODE]);
    expect(result.locales.languages.at(-1)).toEqual({ code: CODE, name: NAME });
    expect(result.locales.strings[CODE]?.['defence.isOff']).toBe('Defence is off');
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain(`data/glossary/${CODE}.json`);
    const lessonIds = readdirSync(join(ROOT, 'content', 'lessons'));
    for (const id of lessonIds) {
      const pattern = new RegExp(`^data/lessons/${id}\\.${CODE}\\.[0-9a-f]{8}\\.json$`);
      expect(paths.some((p) => pattern.test(p))).toBe(true);
    }
  });

  it('appears in the language menu: the bundled site languages list it with its name', async () => {
    tables.withEntry = true;
    const root = project('menu', all);
    writeFileSync(
      join(root, 'entry.js'),
      "import locales from 'virtual:site-locales';\nconsole.log(JSON.stringify(locales.languages));\n",
    );
    writeFileSync(
      join(root, 'index.html'),
      '<!doctype html><title>t</title><script type="module" src="/entry.js"></script>',
    );
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { write: false },
      plugins: [lessonData({ contentRoot: root })],
    });
    if (Array.isArray(out) || !('output' in out)) throw new Error('expected one build output');
    const code = out.output.map((o) => ('code' in o ? o.code : '')).join('\n');
    // The menu (src/ui/App.svelte) draws one button per entry of `languages`.
    expect(code).toMatch(new RegExp(`code:\\s*["\`]${CODE}["\`],\\s*name:\\s*["\`]${NAME}["\`]`));
  });

  it('listed with a lesson missing: the gate is red and names the lesson file', () => {
    tables.withEntry = true;
    const result = buildLessonData(readContent(project('missing-lesson', { ...all, skip: 'B1' })));
    expect(!result.ok && result.errors.join('\n')).toContain(
      `content/lessons/B1/${CODE}.md:1:1: lesson B1 has no ${CODE}.md`,
    );
  });

  it('listed without its folder: the gate names the interface strings, glossary and catalog', () => {
    tables.withEntry = true;
    const result = buildLessonData(
      readContent(project('no-folder', { folder: false, lessons: true, listed: true })),
    );
    const text = !result.ok && result.errors.join('\n');
    expect(text).toContain(`content/locales/${CODE}/ui.md:1:1: `);
    expect(text).toContain(`content/locales/${CODE}/glossary.md:1:1: `);
    expect(text).toContain(`content/locales/${CODE}/catalog.md:1:1: `);
  });

  it('not listed yet: checked, but not on the site', () => {
    tables.withEntry = true;
    const result = buildLessonData(readContent(project('unlisted', { ...all, listed: false })));
    expect(result.ok ? '' : result.errors.join('\n')).toBe('');
    if (!result.ok) return;
    expect(result.locales.languages.map((l) => l.code)).toEqual(['ru', 'en']);
    expect(result.files.some((f) => f.path.includes(`.${CODE}.`))).toBe(false);
  });

  it('without the entry in the word tables: the gate names both tables', () => {
    tables.withEntry = false;
    const result = buildLessonData(readContent(project('no-entry', all)));
    tables.withEntry = true;
    const text = !result.ok && result.errors.join('\n');
    expect(text).toContain('src/core/lesson/headings.ts');
    expect(text).toContain('src/core/glossary/words.ts');
  });
});
