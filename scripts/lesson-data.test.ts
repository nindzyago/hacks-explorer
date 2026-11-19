// M1.1b (design M1.1 r2 E11, decision K37), oracle level D: the build turns checked lessons into
// the site's data files; a broken lesson fails the build with `file:line:column: message`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { readCatalog, readSiteLesson } from '../src/core/lesson/site-read';
import { CATALOG_FILE, MAX_LESSON_FILE_BYTES, lessonFile } from '../src/core/lesson/site';
import { MAX_GLOSSARY_FILE_BYTES, glossaryFile, readSiteGlossary } from '../src/core/glossary/site';
import { readContent } from './content-files.mjs';
import { buildLessonData, lessonData } from './lesson-data';

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
  for (const f of [...real.lessons, ...real.glossaries, ...real.ui, ...languages]) {
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
    expect(names).toHaveLength(real.lessons.length + 1 + real.glossaries.length);
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
      const hash = catalog.value.lessons[0]?.translations[0]?.hash ?? '';
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

describe('the glossary', () => {
  const result = buildLessonData(real);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const glossaryText = fileText(result.files, glossaryFile('ru'));
  const glossary = readSiteGlossary(JSON.parse(glossaryText), 'ru');

  it('is written per language within 30 KB and reads back', () => {
    expect(new TextEncoder().encode(glossaryText).length).toBeLessThanOrEqual(
      MAX_GLOSSARY_FILE_BYTES,
    );
    expect(glossary.ok).toBe(true);
    if (!glossary.ok) return;
    expect(glossary.value.terms.length).toBeGreaterThanOrEqual(25);
    const sqli = glossary.value.terms.find((t) => t.id === 'sql-injection');
    expect(sqli?.lessons).toEqual([{ id: 'B1', title: 'SQL-инъекция' }]);
    expect(glossaryText).not.toMatch(/<[a-zA-Z/!?]/);
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
    const ids = new Set(glossary.ok ? glossary.value.terms.map((t) => t.id) : []);
    const linked = [...text.matchAll(/"type":"term","id":"([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(linked.length).toBeGreaterThan(5);
    expect(linked.filter((id) => !ids.has(id))).toEqual([]);
  });

  const glossaryPath = 'content/locales/ru/glossary.md';
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
      expect(out.errors[0]).toMatch(/^content\/locales\/ru\/glossary\.md:\d+:\d+: /);
    }
  });

  it('fails without a glossary, and on a term a lesson names that does not exist', () => {
    const none = buildLessonData({ ...real, glossaries: [] });
    expect(!none.ok && none.errors).toEqual([
      'content/locales/en/glossary.md:1:1: every site language has a glossary (K94): add content/locales/en/glossary.md',
      'content/locales/ru/glossary.md:1:1: every site language has a glossary (K94): add content/locales/ru/glossary.md',
    ]);
    const unknown = buildLessonData(
      withB1(b1Text.replace('`term:web-server`', '`term:web-servers`')),
    );
    expect(!unknown.ok && unknown.errors.join('\n')).toMatch(
      /^content\/lessons\/B1\/ru\.md:\d+:\d+: `term:web-servers` is not in content\/locales\/ru\/glossary\.md$/m,
    );
  });

  it('fails the build when the glossary data is over 30 KB', () => {
    // Many short valid terms: each within the checker's limits, together over the budget.
    const extra = Array.from(
      { length: 60 },
      (_, i) =>
        `## \`extra-${String(i)}\` Слово ${String(i)}\n\n\`category\` basics\n\n${'Определение слова для проверки размера файла словаря, достаточно длинное. '.repeat(4)}\n`,
    ).join('\n');
    // Russian only: an English glossary without the extra terms would be a translation mismatch.
    const out = buildLessonData({
      ...real,
      lessons: real.lessons.filter((f) => f.path.endsWith('/ru.md')),
      glossaries: [{ path: glossaryPath, text: `${realGlossary}\n${extra}` }],
      languages: {
        path: 'content/locales/languages.md',
        text: '# Языки\n\n`languages` · `format` 1\n\n- `ru` Русский\n',
      },
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.errors.join('\n')).toMatch(
      /the site data of this glossary is \d+ bytes; at most 30720/,
    );
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
      'content/locales/en/glossary.md:1:1: every site language has a glossary',
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
