// M1.1b (design M1.1 r2 E11, decision K37), oracle level D: the build turns checked lessons into
// the site's data files; a broken lesson fails the build with `file:line:column: message`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { readCatalog, readSiteLesson } from '../src/core/lesson/site-read';
import { CATALOG_FILE, MAX_LESSON_FILE_BYTES, lessonFile } from '../src/core/lesson/site';
import {
  MAX_GLOSSARY_FILE_BYTES,
  MAX_GLOSSARY_INDEX_BYTES,
  MAX_GLOSSARY_TERMS,
  glossaryChunkFile,
  glossaryFile,
  glossaryTerm,
  readGlossaryChunk,
  readSiteGlossary,
} from '../src/core/glossary/site';
import { checkGlossaries } from '../src/core/glossary/check';
import type { Glossary } from '../src/core/glossary/types';
import { checkContent } from '../src/core/lesson/check';
import { MAX_TOPICS_FILE_BYTES, readSiteTopics, topicsFile } from '../src/core/topics/site';
import { readContent } from './content-files.mjs';
import { buildLessonData, glossaryDataFiles, lessonData } from './lesson-data';

const real = readContent();

function fileText(files: readonly { path: string; text: string }[], path: string): string {
  const found = files.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no ${path} among ${files.map((f) => f.path).join()}`);
  return found.text;
}

describe('buildLessonData on the real content', () => {
  const result = buildLessonData(real);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const { files } = result;

  const catalog = readCatalog(JSON.parse(fileText(files, CATALOG_FILE)));
  if (!catalog.ok) throw new Error(catalog.error.message);
  const b1 = catalog.value.lessons.find((l) => l.id === 'B1');
  const ru = b1?.translations.find((t) => t.language === 'ru');
  if (ru === undefined) throw new Error('no B1 ru in the catalog');
  const lessonText = fileText(files, lessonFile('B1', 'ru', ru.hash));

  it('writes a catalog with B1: id, section, wave, title per language', () => {
    expect(b1).toMatchObject({ id: 'B1', section: 'B', wave: 1 });
    expect(ru.title).toBe('SQL-инъекция');
    expect(ru.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('writes B1 as its own file within 30 KB', () => {
    expect(new TextEncoder().encode(lessonText).length).toBeLessThanOrEqual(MAX_LESSON_FILE_BYTES);
  });

  it('B1 holds what the site needs, text as a node tree', () => {
    const lesson = readSiteLesson(JSON.parse(lessonText), { id: 'B1', language: 'ru' });
    if (!lesson.ok) throw new Error(lesson.error.message);
    const b = lesson.value;
    expect(b.title).toBe('SQL-инъекция');
    expect(b.passport).toMatchObject({ cwe: [89], owasp: ['A03:2021'], severity: 'critical' });
    expect(b.sources.length).toBeGreaterThan(0);
    expect(b.participants.map((p) => p.id)).toEqual(['attacker', 'server', 'db']);
    expect(b.zones.map((z) => z.id)).toEqual(['internet', 'site']);
    const first = b.steps[0];
    expect(first).toMatchObject({ id: 'form', from: 'attacker', to: 'server', kind: 'legit' });
    expect(first?.levels.simple[0]?.type).toBe('paragraph');
    expect(b.steps.some((s) => s.mode === 'with-defence' && s.stopped)).toBe(true);
    // ⟦…⟧ survives as a marked segment.
    const marked = b.steps.flatMap((s) => s.code?.segments ?? []).filter((s) => s.marked);
    expect(marked.length).toBeGreaterThan(0);
    expect(b.defence?.length).toBeGreaterThan(0);
  });

  it('carries no HTML and no source positions', () => {
    expect(lessonText).not.toMatch(/<[a-zA-Z/!?]/);
    expect(lessonText).not.toContain('"position"');
  });

  it('names a lesson file by its content', () => {
    const again = buildLessonData(real);
    expect(again.ok && again.files.map((f) => f.path)).toEqual(files.map((f) => f.path));
  });
});

// ---------------------------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'lesson-data-'));
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

/**
 * A project folder with an index.html, the real lessons, glossaries, interface strings and
 * languages, and the given lesson
 * files over them.
 */
function project(name: string, lessons: Record<string, string>): string {
  const root = join(work, name);
  const files: Record<string, string> = {};
  const languages = real.languages === null ? [] : [real.languages];
  for (const f of [
    ...real.lessons,
    ...real.glossaries,
    ...real.ui,
    ...languages,
    ...real.catalogs,
  ]) {
    files[f.path] = f.text;
  }
  for (const [path, text] of Object.entries({ ...files, ...lessons })) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  writeFileSync(join(root, 'content', 'sources.md'), real.sources.text);
  if (!('index.html' in lessons)) {
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>t</title><p>t</p>');
  }
  return root;
}

const b1Text = fileText(real.lessons, 'content/lessons/B1/ru.md');

/** The real content with B1 replaced. */
function withB1(text: string) {
  return {
    ...real,
    lessons: real.lessons.map((f) => (f.path === 'content/lessons/B1/ru.md' ? { ...f, text } : f)),
  };
}

describe('a broken lesson', () => {
  const broken = b1Text.replace('#### Глубже', '#### Глубоко');
  const line = b1Text.slice(0, b1Text.indexOf('#### Глубже')).split('\n').length;

  it('gives errors as `file:line:column: message`', () => {
    const result = buildLessonData(withB1(broken));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toContain(`content/lessons/B1/ru.md:${String(line)}:1: `);
  });

  it('fails `vite build` with that message', async () => {
    const root = project('broken', { 'content/lessons/B1/ru.md': broken });
    await expect(
      build({
        root,
        configFile: false,
        logLevel: 'silent',
        build: { write: false },
        plugins: [lessonData({ contentRoot: root })],
      }),
    ).rejects.toThrow(`content/lessons/B1/ru.md:${String(line)}:1: `);
  });
});

describe('vite build', () => {
  it('emits the catalog, one file per lesson per language and the glossary', async () => {
    const root = project('good', { 'content/lessons/B1/ru.md': b1Text });
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { write: false },
      plugins: [lessonData({ contentRoot: root })],
    });
    if (Array.isArray(out) || !('output' in out)) throw new Error('expected one build output');
    const names = out.output.map((o) => o.fileName).filter((n) => n.startsWith('data/'));
    // The catalog, a file per lesson, the glossary (an index and its chunks) and the topics of
    // each site language.
    const chunks = names.filter((n) => /^data\/glossary\/[a-z]+\.[0-9a-f]{8}\.json$/.test(n));
    // One glossary folder per language (G17): its files become one index and chunks.
    const glossaryLanguages = new Set(real.glossaries.map((f) => f.path.split('/')[2])).size;
    expect(chunks.length).toBeGreaterThanOrEqual(glossaryLanguages);
    expect(names).toHaveLength(
      real.lessons.length + 1 + glossaryLanguages + chunks.length + real.catalogs.length,
    );
    expect(names).toContain('data/topics/ru.json');
    expect(names).toContain(CATALOG_FILE);
    expect(names).toContain('data/glossary/ru.json');
    expect(names.some((n) => /^data\/lessons\/B1\.ru\.[0-9a-f]{8}\.json$/.test(n))).toBe(true);
  });

  it('fails when a lesson file is over 30 KB', () => {
    const big = b1Text.replace(
      '#### Глубже',
      `#### Глубже\n\n${Array.from({ length: 600 }, () => 'Длинный текст урока.').join(' ')}\n`,
    );
    const result = buildLessonData(withB1(big));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(
      /^content\/lessons\/B1\/ru\.md:1:1: the site data of this lesson is \d+ bytes; at most 30720/,
    );
  });
});

describe('npm run dev', () => {
  it('serves the same data from memory', async () => {
    const root = project('dev', { 'content/lessons/B1/ru.md': b1Text });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, strictPort: false, host: '127.0.0.1' },
      plugins: [lessonData({ contentRoot: root })],
    });
    await server.listen();
    try {
      const origin = server.resolvedUrls?.local[0] ?? '';
      const catalog = readCatalog(await (await fetch(`${origin}${CATALOG_FILE}`)).json());
      if (!catalog.ok) throw new Error(catalog.error.message);
      const b1 = catalog.value.lessons.find((l) => l.id === 'B1');
      const hash = b1?.translations.find((t) => t.language === 'ru')?.hash ?? '';
      const response = await fetch(`${origin}${lessonFile('B1', 'ru', hash)}`);
      expect(response.headers.get('content-type')).toContain('application/json');
      const lesson = readSiteLesson(await response.json(), { id: 'B1', language: 'ru' });
      expect(lesson.ok).toBe(true);
      expect((await fetch(`${origin}data/lessons/B1.ru.00000000.json`)).status).toBe(404);
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const refused = await fetch(`${origin}${CATALOG_FILE}`, { method });
        expect(refused.status).toBe(405);
        expect(refused.headers.get('allow')).toBe('GET, HEAD');
      }
      const head = await fetch(`${origin}${CATALOG_FILE}`, { method: 'HEAD' });
      expect(head.status).toBe(200);

      // A broken lesson in dev: the data answers 500 with the message, the server lives on.
      writeFileSync(join(root, 'content/lessons/B1/ru.md'), b1Text.replace('`wave` 1', '`wave` 9'));
      const failed = await fetch(`${origin}${CATALOG_FILE}`);
      expect(failed.status).toBe(500);
      expect(await failed.text()).toMatch(/^content\/lessons\/B1\/ru\.md:3:\d+: /);
    } finally {
      await server.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// M2.4 (K98): the glossary is checked with the lessons, its terms are linked in lesson text, and
// a broken or hostile glossary stops the build like a broken lesson.

const bytes = (text: string) => new TextEncoder().encode(text).length;

/** The glossary files of `language` among `files`: the index read back, every term whole. */
function readGlossary(files: readonly { path: string; text: string }[], language: string) {
  const index = readSiteGlossary(JSON.parse(fileText(files, glossaryFile(language))), language);
  if (!index.ok) throw new Error(index.error.message);
  const terms = index.value.chunks.flatMap((hash, n) => {
    const text = fileText(files, glossaryChunkFile(language, hash));
    const chunk = readGlossaryChunk(JSON.parse(text), index.value, n);
    if (!chunk.ok) throw new Error(chunk.error.message);
    return chunk.value.terms.map((t) => glossaryTerm(index.value, chunk.value, t.id));
  });
  return { index: index.value, terms };
}

/** Every glossary file among `files` with its size in bytes. */
function glossarySizes(files: readonly { path: string; text: string }[]) {
  return files
    .filter((f) => f.path.startsWith('data/glossary/'))
    .map((f) => ({ path: f.path, bytes: bytes(f.text) }));
}

describe('the glossary', () => {
  const result = buildLessonData(real);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const { index, terms } = readGlossary(result.files, 'ru');

  it('is written per language as an index and chunks, each within 30 KB, and reads back', () => {
    const sizes = glossarySizes(result.files);
    expect(sizes.filter((s) => s.bytes > MAX_GLOSSARY_FILE_BYTES)).toEqual([]);
    expect(index.terms.length).toBeGreaterThanOrEqual(25);
    expect(terms.map((t) => t?.id)).toEqual(index.terms.map((t) => t.id));
    const sqli = terms.find((t) => t?.id === 'sql-injection');
    expect(sqli?.lessons).toEqual([{ id: 'B1', title: 'SQL-инъекция' }]);
    expect(sqli?.definition.length).toBeGreaterThan(0);
    for (const f of result.files.filter((x) => x.path.startsWith('data/glossary/'))) {
      expect(f.text).not.toMatch(/<[a-zA-Z/!?]/);
    }
    // The index carries no definitions: the list and the search need only titles.
    expect(fileText(result.files, glossaryFile('ru'))).not.toContain('"definition"');
  });

  it('links terms in B1 text, and B1 participants name their terms', () => {
    const catalog = readCatalog(JSON.parse(fileText(result.files, CATALOG_FILE)));
    if (!catalog.ok) throw new Error(catalog.error.message);
    const hash = catalog.value.lessons.find((l) => l.id === 'B1')?.translations[0]?.hash ?? '';
    const text = fileText(result.files, lessonFile('B1', 'ru', hash));
    const b1 = readSiteLesson(JSON.parse(text), { id: 'B1', language: 'ru' });
    if (!b1.ok) throw new Error(b1.error.message);
    expect(text).toContain('"type":"term","id":"sql"');
    expect(b1.value.participants.map((p) => p.term)).toEqual([
      'attacker',
      'web-server',
      'database',
    ]);
    // Every linked id is in the glossary.
    const ids = new Set(index.terms.map((t) => t.id));
    const linked = [...text.matchAll(/"type":"term","id":"([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(linked.length).toBeGreaterThan(5);
    expect(linked.filter((id) => !ids.has(id))).toEqual([]);
  });

  const glossaryPath = 'content/locales/ru/glossary/web.md';
  const realGlossary = fileText(real.glossaries, glossaryPath);
  const withGlossary = (text: string) => ({
    ...real,
    glossaries: real.glossaries.map((f) => (f.path === glossaryPath ? { ...f, text } : f)),
  });

  it('fails the build on a hostile glossary: HTML, unknown ids, huge', () => {
    const cases = [
      realGlossary.replace('Формы: SQL\n', 'Формы: SQL\n\n<script>alert(1)</script>\n'),
      realGlossary.replace('`see` query, database, sql-injection', '`see` query, nothing'),
      realGlossary.replace(
        '`category` web · `see` query, database, sql-injection · `lessons` B1',
        '`category` web · `lessons` Z9',
      ),
      `${realGlossary}\n\n${'Слово. '.repeat(12_000)}`,
    ];
    for (const text of cases) {
      expect(text).not.toBe(realGlossary);
      const out = buildLessonData(withGlossary(text));
      expect(out.ok).toBe(false);
      if (out.ok) continue;
      expect(out.errors.join('\n')).toMatch(/^content\/locales\/ru\/glossary\/web\.md:\d+:\d+: /m);
    }
  });

  it('fails without a glossary, and on a term a lesson names that does not exist', () => {
    const none = buildLessonData({ ...real, glossaries: [] });
    expect(!none.ok && none.errors).toEqual([
      'content/locales/en/glossary/index.md:1:1: every site language has a glossary (K94): add content/locales/en/glossary/index.md',
      'content/locales/ru/glossary/index.md:1:1: every site language has a glossary (K94): add content/locales/ru/glossary/index.md',
    ]);
    const unknown = buildLessonData(
      withB1(b1Text.replace('`term:web-server`', '`term:web-servers`')),
    );
    expect(!unknown.ok && unknown.errors.join('\n')).toMatch(
      /^content\/lessons\/B1\/ru\.md:\d+:\d+: `term:web-servers` is not in content\/locales\/ru\/glossary\/$/m,
    );
  });

  it('splits a glossary larger than one file instead of failing (CI3)', () => {
    // Many short valid terms: each within the checker's limits, together over the budget.
    const extra = Array.from(
      { length: 30 },
      (_, i) =>
        `## \`extra-${String(i)}\` Слово ${String(i)}\n\n\`category\` web\n\n${'Определение слова для проверки размера файла словаря, достаточно длинное. '.repeat(4)}\n`,
    ).join('\n');
    // Russian only: an English glossary without the extra terms would be a translation mismatch.
    const out = buildLessonData({
      ...real,
      lessons: real.lessons.filter((f) => f.path.endsWith('/ru.md')),
      glossaries: real.glossaries
        .filter((f) => f.path.startsWith('content/locales/ru/'))
        .map((f) => (f.path === glossaryPath ? { ...f, text: `${realGlossary}\n${extra}` } : f)),
      languages: {
        path: 'content/locales/languages.md',
        text: '# Языки\n\n`languages` · `format` 1\n\n- `ru` Русский\n',
      },
    });
    if (!out.ok) throw new Error(out.errors.join('\n'));
    const sizes = glossarySizes(out.files);
    expect(sizes.filter((s) => s.bytes > MAX_GLOSSARY_FILE_BYTES)).toEqual([]);
    // As one file this glossary would be well over the budget.
    expect(sizes.reduce((sum, s) => sum + s.bytes, 0)).toBeGreaterThan(MAX_GLOSSARY_FILE_BYTES);
    const back = readGlossary(out.files, 'ru');
    expect(back.index.chunks.length).toBeGreaterThan(1);
    expect(back.terms.filter((t) => t === undefined)).toEqual([]);
    expect(back.terms.map((t) => t?.id)).toContain('extra-29');
  });

  it('keeps every chunk within 30 KB and the index within 60 KB at the cap of terms (CI3, G17)', () => {
    const checked = checkContent(real.lessons, real.sources);
    const all = checkGlossaries(real.glossaries, {
      lessons: checked.lessons,
      lessonPaths: real.lessons.map((f) => f.path),
      siteLanguages: ['ru', 'en'],
    });
    expect(all.errors).toEqual([]);
    for (const g of all.glossaries) {
      // As many copies of today's terms as fit under the cap of the checker.
      const times = Math.max(5, Math.floor(MAX_GLOSSARY_TERMS / g.terms.length));
      const copy = (id: string, k: number) => (k === 0 ? id : `${id.slice(0, 28)}-x${String(k)}`);
      const big: Glossary = {
        ...g,
        terms: Array.from({ length: times }, (_, k) =>
          g.terms.map((t) => ({
            ...t,
            id: copy(t.id, k),
            title: k === 0 ? t.title : `${t.title} ${String(k)}`,
            // Copies are reached from the list and «see also»; only the originals are searched.
            forms: k === 0 ? t.forms : [],
            see: t.see.map((s) => copy(s, k)),
          })),
        ).flat(),
      };
      const titles = new Map(
        checked.lessons.filter((l) => l.language === g.language).map((l) => [l.id, l.title]),
      );
      const out = glossaryDataFiles(big, titles);
      expect(out.errors).toEqual([]);
      const sizes = glossarySizes(out.files);
      const index = glossaryFile(g.language);
      const indexSize = sizes.find((s) => s.path === index)?.bytes ?? Infinity;
      expect(indexSize).toBeLessThanOrEqual(MAX_GLOSSARY_INDEX_BYTES);
      expect(sizes.filter((s) => s.path !== index && s.bytes > MAX_GLOSSARY_FILE_BYTES)).toEqual(
        [],
      );
      // Many times today's data: as one file this would be far over the budget.
      expect(sizes.reduce((sum, s) => sum + s.bytes, 0)).toBeGreaterThan(
        3 * MAX_GLOSSARY_FILE_BYTES,
      );
      const back = readGlossary(out.files, g.language);
      expect(back.terms).toHaveLength(times * g.terms.length);
      expect(back.terms.filter((t) => t === undefined)).toEqual([]);
    }
  });

  it('fails the build when the index alone is over 60 KB, naming the file', () => {
    const g: Glossary = {
      language: 'ru',
      title: 'G',
      index: 'content/locales/ru/glossary/index.md',
      categories: [{ id: 'web', label: 'W', position: { line: 1, column: 1 } }],
      terms: Array.from({ length: MAX_GLOSSARY_TERMS }, (_, i) => ({
        id: `t${String(i)}`,
        title: 'Ж'.repeat(60),
        category: 'web',
        forms: [],
        see: [],
        lessons: [],
        definition: [],
        file: 'content/locales/ru/glossary/web.md',
        position: { line: 1, column: 1 },
      })),
    };
    const out = glossaryDataFiles(g, new Map());
    expect(out.errors).toEqual([
      expect.stringMatching(
        /^content\/locales\/ru\/glossary\/index\.md:1:1: the index of this glossary is \d+ bytes; at most 61440/,
      ),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// M2.3 (K94, K105): the site languages are complete or the build fails (S9); only site
// languages are shipped; the interface strings are a bundled module.

describe('site languages (S9)', () => {
  const russianLessons = real.lessons.filter((f) => f.path.endsWith('/ru.md'));
  const languagesFile = (codes: string) => ({
    path: 'content/locales/languages.md',
    text: `# Языки\n\n\`languages\` · \`format\` 1\n\n${codes}`,
  });

  it('the real content ships Russian and English, each with its strings (M2.3b)', () => {
    const result = buildLessonData(real);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.locales.languages).toEqual([
      { code: 'ru', name: 'Русский' },
      { code: 'en', name: 'English' },
    ]);
    expect(Object.keys(result.locales.strings)).toEqual(['ru', 'en']);
    expect(result.locales.strings['en']?.['defence.isOff']).toBe('Defence is off');
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('data/glossary/en.json');
    for (const id of ['B1', 'I1']) {
      expect(
        paths.some((p) => new RegExp(`^data/lessons/${id}\\.en\\.[0-9a-f]{8}\\.json$`).test(p)),
      ).toBe(true);
    }
  });

  it('S9: English on the list without its lessons, a key and the glossary fails and names each', () => {
    const en = fileText(real.ui, 'content/locales/en/ui.md').replace(
      /^- `player\.pause` .*\n/m,
      '',
    );
    const result = buildLessonData({
      ...real,
      lessons: russianLessons,
      glossaries: real.glossaries.filter((f) => !f.path.includes('/en/')),
      ui: real.ui.map((f) => (f.path === 'content/locales/en/ui.md' ? { ...f, text: en } : f)),
      languages: languagesFile('- `ru` Русский\n- `en` English\n'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.errors.join('\n');
    for (const id of russianLessons.map((f) => /lessons\/([A-Z][0-9]+)\//.exec(f.path)?.[1])) {
      expect(text).toContain(
        `content/lessons/${String(id)}/en.md:1:1: lesson ${String(id)} has no en.md`,
      );
    }
    expect(text).toContain('content/locales/en/ui.md:1:1: missing key player.pause');
    expect(text).toContain(
      'content/locales/en/glossary/index.md:1:1: every site language has a glossary',
    );
  });

  it('fails without languages.md or with a broken one', () => {
    for (const languages of [null, languagesFile('- `en` English\n')]) {
      const result = buildLessonData({ ...real, languages });
      expect(!result.ok && result.errors[0]).toMatch(/^content\/locales\/languages\.md:1:1: /);
    }
  });

  it('a lesson in a language not on the site is checked but not shipped', () => {
    const result = buildLessonData({
      ...real,
      languages: languagesFile('- `ru` Русский\n'),
    });
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const paths = result.files.map((f) => f.path);
    expect(paths.filter((p) => p.includes('.en.') || p.endsWith('/en.json'))).toEqual([]);
    const broken = buildLessonData({
      ...real,
      languages: languagesFile('- `ru` Русский\n'),
      lessons: real.lessons.map((f) =>
        f.path.endsWith('/en.md') ? { ...f, text: f.text.replace('`wave` 1', '`wave` 2') } : f,
      ),
    });
    expect(!broken.ok && broken.errors.join('\n')).toContain('content/lessons/B1/en.md:');
  });

  it('`vite build` bundles the strings of site languages only as virtual:site-locales', async () => {
    const both = await bundledLocales(project('locales-both', entry));
    expect(both).toContain('Защита выключена');
    expect(both).toContain('Defence is off');
    const root = project('locales', {
      ...entry,
      'content/locales/languages.md': languagesFile('- `ru` Русский\n').text,
    });
    const code = await bundledLocales(root);
    expect(code).toContain('Защита выключена');
    expect(code).not.toContain('Defence is off');
  });
});

const entry = {
  'src/entry.js':
    "import locales from 'virtual:site-locales';\nconsole.log(JSON.stringify(locales));\n",
  'index.html':
    '<!doctype html><title>t</title><script type="module" src="/src/entry.js"></script>',
};

async function bundledLocales(root: string): Promise<string> {
  const out = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: { write: false },
    plugins: [lessonData({ contentRoot: root })],
  });
  if (Array.isArray(out) || !('output' in out)) throw new Error('expected one build output');
  return out.output.map((o) => ('code' in o ? o.code : '')).join('\n');
}

// ---------------------------------------------------------------------------------------------
// M2.1b (E3, K112): every topic of the site, per language, for the lessons panel.

describe('topics of the lessons panel', () => {
  it.each(['ru', 'en'])(
    'ships every topic of the site in %s; the lessons that exist are ready',
    (lang) => {
      const result = buildLessonData(real);
      if (!result.ok) throw new Error(result.errors.join('\n'));
      const topics = readSiteTopics(JSON.parse(fileText(result.files, topicsFile(lang))), lang);
      if (!topics.ok) throw new Error(topics.error.message);
      const all = topics.value.sections.flatMap((s) => s.topics);
      expect(topics.value.sections).toHaveLength(12);
      expect(all).toHaveLength(75);
      const ready = all.filter((t) => t.ready).map((t) => t.id);
      const lessonIds = real.lessons
        .filter((f) => f.path.endsWith(`/${lang}.md`))
        .map((f) => /lessons\/([A-Z][0-9]+)\//.exec(f.path)?.[1] ?? '');
      expect(ready.sort()).toEqual(lessonIds.sort());
      const bytes = new TextEncoder().encode(fileText(result.files, topicsFile(lang))).length;
      expect(bytes).toBeLessThanOrEqual(MAX_TOPICS_FILE_BYTES);
    },
  );

  it('a lesson folder that is not in the catalog fails the build and names it', () => {
    const catalogs = real.catalogs.map((f) => ({
      ...f,
      text: f.text.replace(/^- `B1` .*\n/m, ''),
    }));
    const result = buildLessonData({ ...real, catalogs });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toContain(
      'content/lessons/B1:1:1: lesson B1 is not in content/locales/ru/catalog.md',
    );
  });

  it('a site language without its catalog fails the build (K94)', () => {
    const result = buildLessonData({
      ...real,
      catalogs: real.catalogs.filter((f) => !f.path.includes('/en/')),
    });
    expect(!result.ok && result.errors.join('\n')).toContain(
      'content/locales/en/catalog.md:1:1: en is a site language',
    );
  });

  it('a broken catalog line fails with its file and line', () => {
    const catalogs = real.catalogs.map((f) =>
      f.path.includes('/ru/') ? { ...f, text: f.text.replace('- `B8` ', '- `B88x` ') } : f,
    );
    const result = buildLessonData({ ...real, catalogs });
    const ru = fileText(real.catalogs, 'content/locales/ru/catalog.md');
    const line = ru.slice(0, ru.indexOf('- `B8` ')).split('\n').length;
    expect(!result.ok && result.errors.join('\n')).toContain(
      `content/locales/ru/catalog.md:${String(line)}:1: a topic looks like`,
    );
  });
});
