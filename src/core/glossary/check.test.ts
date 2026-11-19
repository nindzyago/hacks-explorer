// M2.4 (K98), oracle D: the glossary checker. A valid glossary parses into data; every broken or
// hostile variant gives an error naming the file, the line and the reason, and the gate stops.
import { describe, expect, it } from 'vitest';
import { checkContent, formatError } from '../lesson/check';
import type { Lesson, LessonError } from '../lesson/types';
import validLesson from '../lesson/fixtures/valid-ru.md?raw';
import { MAX_DEFINITION_CHARS, MAX_TERMS, checkGlossaries } from './check';

const RU = 'content/locales/ru/glossary.md';
const EN = 'content/locales/en/glossary.md';
const LESSON = 'content/lessons/X1/ru.md';

const VALID = `# Словарь

\`glossary\` ru · \`format\` 1

## Разделы

- \`web\` Веб
- \`basics\` Основы

## \`sql\` SQL

\`category\` web · \`see\` query · \`lessons\` X1

Формы: SQL

Язык **запросов** к базе данных, например \`SELECT\`.

## \`query\` Запрос

\`category\` web · \`see\` sql

Формы: запрос, запроса, запросы

Обращение программы к другой программе.

## \`attacker\` Атакующий

\`category\` basics

Тот, кто нападает.
`;

function check(
  files: { path: string; text: string }[],
  lessons: readonly Lesson[] = [],
  lessonPaths: readonly string[] = [LESSON],
) {
  return checkGlossaries(files, { lessons, lessonPaths });
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
/** The one error of a broken copy of VALID. */
function only(text: string): LessonError {
  const { errors } = check([{ path: RU, text }]);
  expect(errors.map(formatError)).toHaveLength(1);
  const [error] = errors;
  if (error === undefined) throw new Error('no error');
  return error;
}

describe('a valid glossary', () => {
  const result = check([{ path: RU, text: VALID }]);

  it('has no errors and gives the data', () => {
    expect(result.errors).toEqual([]);
    const [g] = result.glossaries;
    expect(g?.language).toBe('ru');
    expect(g?.title).toBe('Словарь');
    expect(g?.categories.map((c) => [c.id, c.label])).toEqual([
      ['web', 'Веб'],
      ['basics', 'Основы'],
    ]);
    expect(g?.terms.map((t) => t.id)).toEqual(['sql', 'query', 'attacker']);
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

  it('allows a term without forms: it is reached from the scene and «см. также»', () => {
    expect(result.glossaries[0]?.terms[2]?.forms).toEqual([]);
  });

  it('reads CRLF and a BOM like LF', () => {
    const crlf = `\uFEFF${VALID.replace(/\n/g, '\r\n')}`;
    expect(check([{ path: RU, text: crlf }]).errors).toEqual([]);
  });
});

describe('a broken glossary names the file, the line and the reason', () => {
  it('a «см. также» to a term that does not exist', () => {
    const text = edit(VALID, '`see` query ·', '`see` queries ·');
    const e = only(text);
    expect(e).toMatchObject({ file: RU, code: 'unknown-term', line: lineOf(text, '## `sql`') });
    expect(e.message).toContain('queries');
  });

  it('a term listed twice', () => {
    const text = edit(VALID, '## `attacker` Атакующий', '## `sql` Атакующий');
    expect(only(text)).toMatchObject({
      code: 'duplicate',
      line: lineOf(text, '## `sql` Атакующий'),
    });
  });

  it('a form that belongs to two terms', () => {
    const text = edit(VALID, 'Формы: SQL', 'Формы: SQL, Запрос');
    expect(only(text).message).toContain('belongs to `sql` too');
  });

  it('a lesson that does not exist', () => {
    const text = edit(VALID, '`lessons` X1', '`lessons` X1, Z9');
    expect(only(text)).toMatchObject({ code: 'unknown-lesson', line: lineOf(text, '## `sql`') });
  });

  it('a category that is not listed', () => {
    const text = edit(VALID, '`category` basics', '`category` people');
    expect(only(text).code).toBe('bad-value');
  });

  it('an unknown service word and a missing category', () => {
    expect(only(edit(VALID, '`category` basics', '`category` basics · `colour` red')).code).toBe(
      'unknown-word',
    );
    expect(only(edit(VALID, '`category` basics', '`see` sql')).code).toBe('bad-line');
  });

  it('a pattern instead of a word form', () => {
    for (const form of ['запрос.*', 'запрос[аы]', '(?:запрос)', 'запрос|SQL', 'a\\b']) {
      const text = edit(VALID, 'Формы: запрос, запроса', `Формы: ${form}, запроса`);
      expect(only(text)).toMatchObject({ code: 'bad-value', line: lineOf(text, `Формы: ${form}`) });
    }
  });

  it('HTML, a link and an image in a definition', () => {
    const def = 'Обращение программы к другой программе.';
    expect(only(edit(VALID, def, 'Обращение <br> программы.')).code).toBe('html');
    expect(only(edit(VALID, def, 'См. [пример](https://example.com).')).code).toBe('link');
    expect(only(edit(VALID, def, '![x](https://example.com/x.png)')).code).toBe('image');
    // A broken heading drops the term, so `sql`'s «см. также» to it is reported too.
    const heading = (title: string) =>
      codes(
        check([{ path: RU, text: edit(VALID, '## `query` Запрос', `## \`query\` ${title}`) }])
          .errors,
      );
    expect(heading('<img src=x>')).toEqual(['unknown-term', 'html']);
    expect(heading('&lt;b&gt;')).toEqual(['unknown-term', 'html']);
    expect(heading('**Запрос**')).toEqual(['unknown-term', 'not-allowed']);
  });

  it('a heading inside a definition', () => {
    const text = edit(VALID, 'Тот, кто нападает.', 'Тот, кто нападает.\n\n### Ещё');
    expect(only(text).code).toBe('not-allowed');
  });

  it('a term without a definition', () => {
    const text = edit(VALID, '\nТот, кто нападает.\n', '');
    expect(only(text).code).toBe('empty-section');
  });

  it('a definition that is too long', () => {
    const long = 'Очень длинное определение. '.repeat(Math.ceil(MAX_DEFINITION_CHARS / 20));
    expect(only(edit(VALID, 'Тот, кто нападает.', long)).code).toBe('too-large');
  });

  it('a real-world address', () => {
    const text = edit(VALID, 'Тот, кто нападает.', 'Тот, кто нападает с 8.8.8.8 или evil.com.');
    const { errors } = check([{ path: RU, text }]);
    expect(codes(errors)).toEqual(['address', 'address']);
    expect(errors[0]?.line).toBe(lineOf(text, '8.8.8.8'));
  });

  it('a wrong title, header or categories heading', () => {
    expect(only(edit(VALID, '# Словарь', '# Глоссарий')).code).toBe('missing-title');
    expect(only(edit(VALID, '`glossary` ru', '`glossary` en')).code).toBe('bad-header');
    expect(
      codes(check([{ path: RU, text: edit(VALID, '## Разделы', '## Темы') }]).errors),
    ).toContain('missing-section');
  });

  it('a wrong path or an unknown language', () => {
    expect(codes(check([{ path: 'content/glossary/ru.md', text: VALID }]).errors)).toContain(
      'bad-path',
    );
    expect(
      codes(check([{ path: 'content/locales/xx/glossary.md', text: VALID }]).errors),
    ).toContain('unknown-language');
  });
});

describe('a hostile glossary fails, quickly and without throwing', () => {
  it('a huge file', () => {
    const huge = VALID + 'а'.repeat(70 * 1024);
    expect(codes(check([{ path: RU, text: huge }]).errors)).toEqual(['too-large']);
  });

  it('too many terms', () => {
    const terms = Array.from(
      { length: MAX_TERMS + 1 },
      (_, i) => `## \`t${String(i)}\` T\n\n\`category\` web\n\nD.\n`,
    ).join('\n');
    const text = `# Словарь\n\n\`glossary\` ru · \`format\` 1\n\n## Разделы\n\n- \`web\` Веб\n\n${terms}`;
    const started = Date.now();
    expect(codes(check([{ path: RU, text }]).errors)).toContain('too-large');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('not text, an empty file and garbage', () => {
    expect(codes(check([{ path: RU, text: 42 as unknown as string }]).errors)).toEqual([
      'parse-failed',
    ]);
    expect(check([{ path: RU, text: '' }]).errors.length).toBeGreaterThan(0);
    expect(check([{ path: RU, text: '\u0000<<<>>>[[[' }]).errors.length).toBeGreaterThan(0);
  });

  it('many errors are capped', () => {
    const terms = Array.from(
      { length: 150 },
      (_, i) => `## \`t${String(i)}\` T\n\n\`category\` zzz · \`see\` nope\n\nD.\n`,
    ).join('\n');
    const text = `# Словарь\n\n\`glossary\` ru · \`format\` 1\n\n## Разделы\n\n- \`web\` Веб\n\n${terms}`;
    const { errors } = check([{ path: RU, text }]);
    expect(errors).toHaveLength(101);
    expect(errors[100]?.code).toBe('too-many-errors');
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

  it('a participant names an existing term: fine', () => {
    const checked = lessons(lessonWith(' · `term:attacker`'));
    expect(checked.errors).toEqual([]);
    expect(check([{ path: RU, text: VALID }], checked.lessons).errors).toEqual([]);
  });

  it('a participant names a term that is not in the glossary: error in the lesson file', () => {
    const text = lessonWith(' · `term:hacker`');
    const checked = lessons(text);
    expect(checked.errors).toEqual([]);
    const { errors } = check([{ path: RU, text: VALID }], checked.lessons);
    expect(errors.map(formatError)).toEqual([
      `${LESSON}:${String(lineOf(text, '- `attacker`'))}:3: \`term:hacker\` is not in ${RU}`,
    ]);
  });

  it('every lesson language needs a glossary (K94)', () => {
    const { errors } = check([{ path: RU, text: VALID }], [], [LESSON, 'content/lessons/X1/en.md']);
    expect(errors.map(formatError)).toEqual([
      `${EN}:1:1: every site language has a glossary (K94): add ${EN}`,
    ]);
    expect(codes(check([], [], [LESSON]).errors)).toEqual(['missing-glossary']);
  });

  it('no lessons and no glossaries: nothing to check', () => {
    expect(check([], [], [])).toEqual({ glossaries: [], errors: [] });
  });

  it('a translation has the same ids, categories, see and lessons in the same order', () => {
    const en = VALID.replace('# Словарь', '# Glossary')
      .replace('`glossary` ru', '`glossary` en')
      .replace('## Разделы', '## Sections')
      .replace(/Формы:/g, 'Forms:')
      .replace('Запрос\n', 'Query\n');
    expect(
      check([
        { path: RU, text: VALID },
        { path: EN, text: en },
      ]).errors,
    ).toEqual([]);
    const broken = edit(en, '`see` sql', '`see` attacker');
    const { errors, glossaries } = check([
      { path: RU, text: VALID },
      { path: EN, text: broken },
    ]);
    expect(codes(errors)).toEqual(['translation-mismatch']);
    expect(errors[0]?.file).toBe(EN);
    expect(glossaries.map((g) => g.language)).toEqual(['ru']);
    const missing = en.slice(0, en.indexOf('## `attacker`'));
    expect(
      codes(
        check([
          { path: RU, text: VALID },
          { path: EN, text: missing },
        ]).errors,
      ),
    ).toEqual(['translation-mismatch']);
  });
});
