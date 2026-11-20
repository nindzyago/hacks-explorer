// M2.4 (K98), G17 (K133): the glossary checker. A glossary is a folder per language,
// content/locales/<lang>/glossary/: index.md (title, header, categories) and one file per
// category (`web.md`, continued in `web.2.md` … `web.9.md`). A valid glossary parses into data;
// every broken or hostile variant gives an error naming the file, the line and the reason, and
// the gate stops. Ids, forms and «see» are checked across all files of a language.
import { describe, expect, it } from 'vitest';
import { checkContent, formatError } from '../lesson/check';
import type { Lesson, LessonError } from '../lesson/types';
import validLesson from '../lesson/fixtures/valid-ru.md?raw';
import {
  MAX_DEFINITION_CHARS,
  MAX_GLOSSARY_FILES,
  MAX_TERMS,
  checkGlossaries,
  glossaryDir,
  glossaryIndexPath,
} from './check';

const DIR = 'content/locales/ru/glossary';
const INDEX = `${DIR}/index.md`;
const WEB = `${DIR}/web.md`;
const BASICS = `${DIR}/basics.md`;
const EN_DIR = 'content/locales/en/glossary';
const EN_INDEX = `${EN_DIR}/index.md`;
const LESSON = 'content/lessons/X1/ru.md';

const INDEX_TEXT = `# Словарь

\`glossary\` ru · \`format\` 2

## Разделы

- \`web\` Веб
- \`basics\` Основы
`;

const WEB_TEXT = `# Веб

\`glossary\` ru · \`category\` web

## \`sql\` SQL

\`category\` web · \`see\` query · \`lessons\` X1

Формы: SQL

Язык **запросов** к базе данных, например \`SELECT\`.

## \`query\` Запрос

\`category\` web · \`see\` sql

Формы: запрос, запроса, запросы

Обращение программы к другой программе.
`;

const BASICS_TEXT = `# Основы

\`glossary\` ru · \`category\` basics

## \`attacker\` Атакующий

\`category\` basics

Тот, кто нападает.
`;

type Files = Record<string, string>;
const VALID: Files = { [INDEX]: INDEX_TEXT, [WEB]: WEB_TEXT, [BASICS]: BASICS_TEXT };

function check(
  files: Files | { path: string; text: string }[],
  lessons: readonly Lesson[] = [],
  lessonPaths: readonly string[] = [LESSON],
) {
  const list = Array.isArray(files)
    ? files
    : Object.entries(files).map(([path, text]) => ({ path, text }));
  return checkGlossaries(list, { lessons, lessonPaths });
}
function codes(errors: readonly LessonError[]) {
  return errors.map((e) => e.code);
}
function edit(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`edit: need one "${from}"`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
function lineOf(text: string, needle: string): number {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`lineOf: no "${needle}"`);
  return text.slice(0, at).split('\n').length;
}
/** VALID with one file replaced. */
function withFile(path: string, text: string): Files {
  return { ...VALID, [path]: text };
}
/** VALID without one file. */
function without(path: string): Files {
  return Object.fromEntries(Object.entries(VALID).filter(([p]) => p !== path));
}
/** The one error of a broken copy of VALID. */
function only(files: Files): LessonError {
  const { errors } = check(files);
  expect(errors.map(formatError)).toHaveLength(1);
  const [error] = errors;
  if (error === undefined) throw new Error('no error');
  return error;
}
/** The one error of VALID with `path` edited. */
function onlyIn(path: string, from: string, to: string): LessonError {
  const text = edit(VALID[path] ?? '', from, to);
  const e = only(withFile(path, text));
  expect(e.file).toBe(path);
  return e;
}

describe('a valid glossary', () => {
  const result = check(VALID);

  it('has no errors and gives the data, in category order, then file order', () => {
    expect(result.errors).toEqual([]);
    const [g] = result.glossaries;
    expect(g?.language).toBe('ru');
    expect(g?.title).toBe('Словарь');
    expect(g?.categories.map((c) => [c.id, c.label])).toEqual([
      ['web', 'Веб'],
      ['basics', 'Основы'],
    ]);
    expect(g?.terms.map((t) => t.id)).toEqual(['sql', 'query', 'attacker']);
    expect(g?.terms.map((t) => t.file)).toEqual([WEB, WEB, BASICS]);
    expect(g?.terms[1]).toMatchObject({
      title: 'Запрос',
      category: 'web',
      forms: ['запрос', 'запроса', 'запросы'],
      see: ['sql'],
      lessons: [],
    });
    expect(g?.terms[0]?.lessons).toEqual(['X1']);
    expect(g?.terms[0]?.definition[0]?.type).toBe('paragraph');
  });

  it('the order of the files given does not matter', () => {
    const reversed = Object.entries(VALID)
      .reverse()
      .map(([path, text]) => ({ path, text }));
    expect(check(reversed).glossaries[0]?.terms.map((t) => t.id)).toEqual([
      'sql',
      'query',
      'attacker',
    ]);
  });

  it('allows a term without forms: it is reached from the scene and «см. также»', () => {
    expect(result.glossaries[0]?.terms[2]?.forms).toEqual([]);
  });

  it('allows a category without a file: it has no terms yet', () => {
    const rest = without(BASICS);
    const out = check(rest);
    expect(out.errors).toEqual([]);
    expect(out.glossaries[0]?.terms.map((t) => t.id)).toEqual(['sql', 'query']);
  });

  it('continues a category in web.2.md … web.9.md, in number order', () => {
    const web2 = `# Веб\n\n\`glossary\` ru · \`category\` web\n\n## \`xss\` XSS\n\n\`category\` web · \`see\` sql\n\nВнедрение скрипта.\n`;
    const web3 = `# Веб\n\n\`glossary\` ru · \`category\` web\n\n## \`csrf\` CSRF\n\n\`category\` web\n\nПодделка запроса.\n`;
    const out = check({ ...VALID, [`${DIR}/web.3.md`]: web3, [`${DIR}/web.2.md`]: web2 });
    expect(out.errors).toEqual([]);
    expect(out.glossaries[0]?.terms.map((t) => t.id)).toEqual([
      'sql',
      'query',
      'xss',
      'csrf',
      'attacker',
    ]);
  });

  it('reads CRLF and a BOM like LF', () => {
    const crlf = Object.fromEntries(
      Object.entries(VALID).map(([p, t]) => [p, `\uFEFF${t.replace(/\n/g, '\r\n')}`]),
    );
    expect(check(crlf).errors).toEqual([]);
  });

  it('names its paths', () => {
    expect(glossaryDir('ru')).toBe(DIR);
    expect(glossaryIndexPath('ru')).toBe(INDEX);
  });
});

describe('a broken glossary names the file, the line and the reason', () => {
  it('a «см. также» to a term that does not exist', () => {
    const e = onlyIn(WEB, '`see` query ·', '`see` queries ·');
    expect(e).toMatchObject({ code: 'unknown-term', line: lineOf(WEB_TEXT, '## `sql`') });
    expect(e.message).toContain('queries');
  });

  it('a «см. также» to a term in another file resolves', () => {
    const text = edit(WEB_TEXT, '`see` sql\n', '`see` sql, attacker\n');
    expect(check(withFile(WEB, text)).errors).toEqual([]);
    const rest = without(BASICS);
    expect(only({ ...rest, [WEB]: text })).toMatchObject({ file: WEB, code: 'unknown-term' });
  });

  it('a term listed twice in one file', () => {
    const text = `${BASICS_TEXT}\n## \`attacker\` Ещё раз\n\n\`category\` basics\n\nТекст.\n`;
    expect(only(withFile(BASICS, text))).toMatchObject({
      file: BASICS,
      code: 'duplicate',
      line: lineOf(text, '## `attacker` Ещё раз'),
    });
  });

  it('a term listed in two files: the second names the first', () => {
    const text = edit(BASICS_TEXT, '## `attacker`', '## `sql`');
    const e = only(withFile(BASICS, text));
    expect(e).toMatchObject({ file: BASICS, code: 'duplicate', line: lineOf(text, '## `sql`') });
    expect(e.message).toContain(`${WEB}:${String(lineOf(WEB_TEXT, '## `sql`'))}`);
  });

  it('a form that belongs to two terms, in one file or in two', () => {
    expect(onlyIn(WEB, 'Формы: SQL', 'Формы: SQL, Запрос').message).toContain(
      'belongs to `sql` too',
    );
    const text = edit(
      BASICS_TEXT,
      '`category` basics\n\nТот',
      '`category` basics\n\nФормы: запросы\n\nТот',
    );
    const e = only(withFile(BASICS, text));
    expect(e).toMatchObject({ file: BASICS, code: 'duplicate' });
    expect(e.message).toContain('belongs to `query` too');
  });

  it('a lesson that does not exist', () => {
    expect(onlyIn(WEB, '`lessons` X1', '`lessons` X1, Z9')).toMatchObject({
      code: 'unknown-lesson',
      line: lineOf(WEB_TEXT, '## `sql`'),
    });
  });

  it('a term in the file of another category', () => {
    const e = onlyIn(BASICS, '`category` basics\n\nТот', '`category` web\n\nТот');
    expect(e).toMatchObject({ code: 'bad-value', line: lineOf(BASICS_TEXT, '## `attacker`') });
    expect(e.message).toContain('web.md');
  });

  it('a category that is not listed', () => {
    expect(onlyIn(BASICS, '`category` basics\n\nТот', '`category` people\n\nТот').code).toBe(
      'bad-value',
    );
  });

  it('an unknown service word and a missing category', () => {
    expect(
      onlyIn(BASICS, '`category` basics\n\nТот', '`category` basics · `colour` red\n\nТот').code,
    ).toBe('unknown-word');
    expect(onlyIn(BASICS, '`category` basics\n\nТот', '`see` sql\n\nТот').code).toBe('bad-line');
  });

  it('a pattern instead of a word form', () => {
    for (const form of ['запрос.*', 'запрос[аы]', '(?:запрос)', 'запрос|SQL', 'a\\b']) {
      const text = edit(WEB_TEXT, 'Формы: запрос, запроса', `Формы: ${form}, запроса`);
      expect(only(withFile(WEB, text))).toMatchObject({
        code: 'bad-value',
        line: lineOf(text, `Формы: ${form}`),
      });
    }
  });

  it('an empty form between commas', () => {
    for (const forms of ['запрос, , запроса', 'запрос,', ', запрос']) {
      const text = edit(WEB_TEXT, 'Формы: запрос, запроса, запросы', `Формы: ${forms}`);
      expect(only(withFile(WEB, text))).toMatchObject({
        code: 'bad-value',
        line: lineOf(text, `Формы: ${forms}`),
      });
    }
  });

  it('HTML, a link and an image in a definition', () => {
    const def = 'Обращение программы к другой программе.';
    expect(onlyIn(WEB, def, 'Обращение <br> программы.').code).toBe('html');
    expect(onlyIn(WEB, def, 'См. [пример](https://example.com).').code).toBe('link');
    expect(onlyIn(WEB, def, '![x](https://example.com/x.png)').code).toBe('image');
    // A broken heading drops the term, so `sql`'s «см. также» to it is reported too.
    const heading = (title: string) =>
      codes(
        check(withFile(WEB, edit(WEB_TEXT, '## `query` Запрос', `## \`query\` ${title}`))).errors,
      );
    expect(heading('<img src=x>')).toEqual(['unknown-term', 'html']);
    expect(heading('&lt;b&gt;')).toEqual(['unknown-term', 'html']);
    expect(heading('**Запрос**')).toEqual(['unknown-term', 'not-allowed']);
  });

  it('a heading inside a definition', () => {
    expect(onlyIn(BASICS, 'Тот, кто нападает.', 'Тот, кто нападает.\n\n### Ещё').code).toBe(
      'not-allowed',
    );
  });

  it('a term without a definition', () => {
    expect(onlyIn(BASICS, '\nТот, кто нападает.\n', '').code).toBe('empty-section');
  });

  it('a definition that is too long', () => {
    const long = 'Очень длинное определение. '.repeat(Math.ceil(MAX_DEFINITION_CHARS / 20));
    expect(onlyIn(BASICS, 'Тот, кто нападает.', long).code).toBe('too-large');
  });

  it('a real-world address', () => {
    const text = edit(
      BASICS_TEXT,
      'Тот, кто нападает.',
      'Тот, кто нападает с 8.8.8.8 или evil.com.',
    );
    const { errors } = check(withFile(BASICS, text));
    expect(codes(errors)).toEqual(['address', 'address']);
    expect(errors[0]).toMatchObject({ file: BASICS, line: lineOf(text, '8.8.8.8') });
  });

  it('a CWE, ATT&CK, OWASP or CVE id that is not vetted (M2.8, K86)', () => {
    const vetted = 'CWE-89, T1566.002, A03:2021 и CVE-2021-44228.';
    expect(check(withFile(BASICS, edit(BASICS_TEXT, 'Тот, кто нападает.', vetted))).errors).toEqual(
      [],
    );
    for (const id of ['CWE-99999', 'T9999', 'A42:2021', 'CVE-2099-0001']) {
      const text = edit(BASICS_TEXT, 'Тот, кто нападает.', `Пример: ${id}.`);
      expect(only(withFile(BASICS, text))).toMatchObject({
        code: 'unknown-id',
        line: lineOf(text, id),
      });
    }
  });

  it('a wrong title, header or categories heading in the index', () => {
    expect(onlyIn(INDEX, '# Словарь', '# Глоссарий').code).toBe('missing-title');
    expect(onlyIn(INDEX, '`glossary` ru', '`glossary` en').code).toBe('bad-header');
    expect(onlyIn(INDEX, '`format` 2', '`format` 1').code).toBe('bad-header');
    expect(
      codes(check(withFile(INDEX, edit(INDEX_TEXT, '## Разделы', '## Темы'))).errors),
    ).toContain('missing-section');
  });

  it('a term in the index: terms live in the category files', () => {
    const text = `${INDEX_TEXT}\n## \`x\` X\n\n\`category\` web\n\nX.\n`;
    expect(only(withFile(INDEX, text))).toMatchObject({
      file: INDEX,
      code: 'stray-content',
      line: lineOf(text, '## `x`'),
    });
  });

  it('a category named index cannot have a file', () => {
    expect(onlyIn(INDEX, '- `basics` Основы', '- `basics` Основы\n- `index` Всё').code).toBe(
      'bad-value',
    );
  });

  it('a wrong title or header in a category file', () => {
    expect(onlyIn(WEB, '# Веб', '# Web')).toMatchObject({ code: 'missing-title', line: 1 });
    expect(onlyIn(WEB, '`category` web\n\n## `sql`', '`category` basics\n\n## `sql`').code).toBe(
      'bad-header',
    );
    expect(onlyIn(WEB, '`glossary` ru', '`glossary` en').code).toBe('bad-header');
    expect(onlyIn(WEB, '\n## `sql` SQL', '\nТекст до терминов.\n\n## `sql` SQL').code).toBe(
      'stray-content',
    );
  });

  it('a wrong path, an unknown language, a file of an unknown category', () => {
    expect(codes(check([{ path: 'content/glossary/ru.md', text: INDEX_TEXT }]).errors)).toContain(
      'bad-path',
    );
    expect(
      codes(check([{ path: 'content/locales/xx/glossary/index.md', text: INDEX_TEXT }]).errors),
    ).toContain('unknown-language');
    for (const name of ['people.md', 'web.1.md', 'web.10.md', 'Web.md', 'notes.txt', 'a/b.md']) {
      const path = `${DIR}/${name}`;
      const { errors } = check({ ...VALID, [path]: WEB_TEXT });
      expect(errors.map((e) => [e.file, e.code])).toEqual([[path, 'bad-path']]);
    }
  });

  it('the old single file names the new place', () => {
    const { errors } = check({ ...VALID, 'content/locales/ru/glossary.md': INDEX_TEXT });
    expect(errors.map(formatError)).toEqual([
      expect.stringMatching(
        /^content\/locales\/ru\/glossary\.md:1:1: .*content\/locales\/ru\/glossary\/index\.md/,
      ),
    ]);
  });

  it('category files without an index', () => {
    const rest = without(INDEX);
    expect(check(rest).errors.map(formatError)).toEqual([
      `${INDEX}:1:1: every site language has a glossary (K94): add ${INDEX}`,
    ]);
  });
});

describe('a hostile glossary fails, quickly and without throwing', () => {
  it('a huge file: the limit is per file', () => {
    const huge = BASICS_TEXT + 'а'.repeat(70 * 1024);
    expect(check(withFile(BASICS, huge)).errors.map((e) => [e.file, e.code])).toEqual([
      [BASICS, 'too-large'],
    ]);
  });

  /** `count` one-line terms in `files` files of category web, at most 300 per file. */
  function manyTerms(count: number): Files {
    const out: Files = { [INDEX]: INDEX_TEXT };
    const perFile = 300;
    for (let f = 0; f * perFile < count; f += 1) {
      const n = Math.min(perFile, count - f * perFile);
      const terms = Array.from(
        { length: n },
        (_, i) => `## \`t${String(f * perFile + i)}\` T`,
      ).join('\n');
      const name = f === 0 ? 'web.md' : `web.${String(f + 1)}.md`;
      const text = `# Веб\n\n\`glossary\` ru · \`category\` web\n\n${terms}\n`;
      expect(text.split('\n').length).toBeLessThan(1000);
      out[`${DIR}/${name}`] = text;
    }
    return out;
  }

  it('too many terms across the files: the cap stops it, at the file that passes it', () => {
    const started = Date.now();
    const { errors } = check(manyTerms(MAX_TERMS + 1));
    expect(codes(errors)).toEqual(['too-large']);
    expect(errors[0]?.message).toContain(`more than ${String(MAX_TERMS)} terms`);
    expect(errors[0]?.file).toBe(`${DIR}/web.3.md`);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('exactly the cap of terms passes the cap', () => {
    // Each term then lacks its lines, but none of the errors is the cap.
    expect(codes(check(manyTerms(MAX_TERMS)).errors)).not.toContain('too-large');
  });

  it('too many files in one glossary', () => {
    const files: Files = { ...VALID };
    for (let i = 0; i <= MAX_GLOSSARY_FILES; i += 1) files[`${DIR}/x${String(i)}.md`] = 'x';
    const started = Date.now();
    const { errors } = check(files);
    expect(errors.map((e) => [e.file, e.code])).toEqual([[DIR, 'too-large']]);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('NUL and bidirectional control characters', () => {
    for (const c of ['\u0000', '‪', '‮', '⁦', '⁩']) {
      const text = edit(BASICS_TEXT, 'Тот, кто нападает.', `Тот, кто ${c}нападает.`);
      expect(only(withFile(BASICS, text))).toMatchObject({
        code: 'not-allowed',
        line: lineOf(text, 'Тот, кто'),
      });
      expect(only(withFile(INDEX, `${INDEX_TEXT}${c}\n`)).code).toBe('not-allowed');
    }
  });

  it('not text, an empty file and garbage', () => {
    for (const path of [INDEX, BASICS]) {
      const others = Object.entries(VALID)
        .filter(([p]) => p !== path)
        .map(([p, text]) => ({ path: p, text }));
      const notText = codes(check([...others, { path, text: 42 as unknown as string }]).errors);
      expect(notText).toContain('parse-failed');
      expect(check(withFile(path, '')).errors.length).toBeGreaterThan(0);
      expect(check(withFile(path, '\u0000<<<>>>[[[')).errors.length).toBeGreaterThan(0);
    }
    expect(
      codes(check([{ path: 42 as unknown as string, text: INDEX_TEXT }], [], []).errors),
    ).toEqual(['bad-path']);
  });

  it('many errors are capped per file', () => {
    const terms = Array.from(
      { length: 150 },
      (_, i) => `## \`t${String(i)}\` T\n\n\`category\` zzz · \`see\` nope\n\nD.\n`,
    ).join('\n');
    const text = `# Веб\n\n\`glossary\` ru · \`category\` web\n\n${terms}`;
    const { errors } = check(withFile(WEB, text));
    const inWeb = errors.filter((e) => e.file === WEB);
    expect(inWeb).toHaveLength(101);
    expect(inWeb[100]?.code).toBe('too-many-errors');
  });
});

describe('glossaries and lessons together', () => {
  const lessonWith = (participantWord: string) =>
    validLesson.replace(/^(- `attacker` \*\*[^\n]*)$/m, `$1${participantWord}`);
  const lessons = (text: string) =>
    checkContent([{ path: LESSON, text }], {
      path: 'content/sources.md',
      text: '- `owasp.org` OWASP\n- `mitre.org` MITRE\n',
    });

  it('a participant names an existing term in any file: fine', () => {
    const checked = lessons(lessonWith(' · `term:attacker`'));
    expect(checked.errors).toEqual([]);
    expect(check(VALID, checked.lessons).errors).toEqual([]);
  });

  it('a participant names a term that is not in the glossary: error in the lesson file', () => {
    const text = lessonWith(' · `term:hacker`');
    const checked = lessons(text);
    expect(checked.errors).toEqual([]);
    const { errors } = check(VALID, checked.lessons);
    expect(errors.map(formatError)).toEqual([
      `${LESSON}:${String(lineOf(text, '- `attacker`'))}:3: \`term:hacker\` is not in ${DIR}/`,
    ]);
  });

  it('every lesson language needs a glossary (K94)', () => {
    const { errors } = check(VALID, [], [LESSON, 'content/lessons/X1/en.md']);
    expect(errors.map(formatError)).toEqual([
      `${EN_INDEX}:1:1: every site language has a glossary (K94): add ${EN_INDEX}`,
    ]);
    expect(codes(check([], [], [LESSON]).errors)).toEqual(['missing-glossary']);
  });

  it('no lessons and no glossaries: nothing to check', () => {
    expect(check([], [], [])).toEqual({ glossaries: [], errors: [] });
  });

  const EN: Files = {
    [EN_INDEX]: INDEX_TEXT.replace('# Словарь', '# Glossary')
      .replace('`glossary` ru', '`glossary` en')
      .replace('## Разделы', '## Sections')
      .replace('`web` Веб', '`web` Web')
      .replace('`basics` Основы', '`basics` Basics'),
    [`${EN_DIR}/web.md`]: WEB_TEXT.replace('# Веб', '# Web')
      .replace('`glossary` ru', '`glossary` en')
      .replace(/Формы:/g, 'Forms:')
      .replace('Запрос\n', 'Query\n'),
    [`${EN_DIR}/basics.md`]: BASICS_TEXT.replace('# Основы', '# Basics').replace(
      '`glossary` ru',
      '`glossary` en',
    ),
  };

  it('a translation has the same files, ids, categories, see and lessons in the same order', () => {
    expect(check({ ...VALID, ...EN }).errors).toEqual([]);
    const web = `${EN_DIR}/web.md`;
    const broken = edit(EN[web] ?? '', '`see` sql\n', '`see` attacker\n');
    const { errors, glossaries } = check({ ...VALID, ...EN, [web]: broken });
    expect(codes(errors)).toEqual(['translation-mismatch']);
    expect(errors[0]).toMatchObject({ file: web, line: lineOf(broken, '## `query`') });
    expect(glossaries.map((g) => g.language)).toEqual(['ru']);
  });

  it('a translation without a term, or without a file, names the file', () => {
    const term = (id: string) => `## \`${id}\` ${id.toUpperCase()}\n\n\`category\` web\n\nТекст.\n`;
    const ru2 = `# Веб\n\n\`glossary\` ru · \`category\` web\n\n${term('xss')}\n${term('csrf')}`;
    const en2 = (ids: string[]) =>
      `# Web\n\n\`glossary\` en · \`category\` web\n\n${ids.map(term).join('\n')}`;
    const both = { ...VALID, ...EN, [`${DIR}/web.2.md`]: ru2 };
    expect(check({ ...both, [`${EN_DIR}/web.2.md`]: en2(['xss', 'csrf']) }).errors).toEqual([]);
    const missingTerm = check({ ...both, [`${EN_DIR}/web.2.md`]: en2(['xss']) });
    expect(missingTerm.errors.map((e) => [e.file, e.code])).toEqual([
      [`${EN_DIR}/web.2.md`, 'translation-mismatch'],
    ]);
    const missingFile = check(both);
    expect(missingFile.errors.map((e) => [e.file, e.code, e.line])).toEqual([
      [`${EN_DIR}/web.2.md`, 'translation-mismatch', 1],
    ]);
    const extraFile = check({ ...VALID, ...EN, [`${EN_DIR}/web.2.md`]: en2(['xss']) });
    expect(extraFile.errors.map((e) => [e.file, e.code])).toEqual([
      [`${EN_DIR}/web.2.md`, 'translation-mismatch'],
    ]);
  });

  it('a term moved to a continuation file in the translation is a mismatch', () => {
    const web = `${EN_DIR}/web.md`;
    const text = EN[web] ?? '';
    const at = text.indexOf('## `query`');
    const head = '# Web\n\n`glossary` en · `category` web\n\n';
    const { errors } = check({
      ...VALID,
      ...EN,
      [web]: text.slice(0, at),
      [`${EN_DIR}/web.2.md`]: head + text.slice(at),
    });
    expect(codes(errors)).toContain('translation-mismatch');
  });
});
