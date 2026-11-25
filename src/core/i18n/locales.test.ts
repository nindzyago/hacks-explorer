// M2.3 (E2, E3, K94, K105): the interface strings file, the list of site languages and the
// completeness of every site language. Scenario S9 at the level of the checker; the build-level
// S9 is in scripts/lesson-data.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatError } from '../lesson/check';
import { parseLanguages } from './languages-file';
import { checkLocales } from './locales';
import { aroundPlaceholder, fill } from './say';
import { MAX_UI_FILE_BYTES, parseUiFile, placeholdersOf, uiPath } from './ui-file';

const file = (lang: string) =>
  readFileSync(new URL(`../../../${uiPath(lang)}`, import.meta.url), 'utf8');
const ruText = file('ru');
const enText = file('en');
const head = (lang: string) => `# Interface\n\n\`ui\` ${lang} · \`format\` 1\n\n`;
const LANGS = '# Языки\n\n`languages` · `format` 1\n\n- `ru` Русский\n';

describe('parseUiFile', () => {
  it('reads the real Russian and English files with the same keys', () => {
    const ru = parseUiFile(uiPath('ru'), ruText);
    const en = parseUiFile(uiPath('en'), enText);
    if (!ru.ok || !en.ok) throw new Error('the real ui.md files have errors');
    expect(ru.file.entries.size).toBeGreaterThan(90);
    expect([...en.file.entries.keys()]).toEqual([...ru.file.entries.keys()]);
    expect(ru.file.entries.get('defence.isOff')?.text).toBe('Защита выключена');
    expect(en.file.entries.get('defence.isOff')?.text).toBe('Defence is off');
    expect(ru.file.entries.get('player.status')?.placeholders).toEqual(['count', 'step']);
  });

  it('keeps notes for translators and ## groups out of the strings', () => {
    const r = parseUiFile(
      uiPath('de'),
      `${head('de')}Ein Hinweis.\n\n## Gruppe\n\n- \`a.b\` Text\n`,
    );
    expect(r.ok && [...r.file.entries]).toEqual([
      ['a.b', { text: 'Text', line: 9, placeholders: [] }],
    ]);
  });

  it.each([
    ['no title', '`ui` de · `format` 1\n', 'missing-title'],
    ['a wrong header', '# T\n\n`ui` en · `format` 1\n', 'bad-header'],
    ['a wrong format', '# T\n\n`ui` de · `format` 2\n', 'bad-header'],
    ['a bad line', `${head('de')}- a.b Text\n`, 'bad-line'],
    ['a bad key', `${head('de')}- \`A.b\` Text\n`, 'bad-value'],
    ['a one-part key', `${head('de')}- \`tagline\` Text\n`, 'bad-value'],
    ['an empty text', `${head('de')}- \`a.b\`\n`, 'bad-value'],
    ['a duplicate key', `${head('de')}- \`a.b\` X\n- \`a.b\` Y\n`, 'duplicate'],
    ['HTML', `${head('de')}- \`a.b\` <b>X</b>\n`, 'html'],
    ['a stray brace', `${head('de')}- \`a.b\` X {count\n`, 'bad-value'],
    ['a brace that is no value', `${head('de')}- \`a.b\` X {Count}\n`, 'bad-value'],
    ['a NUL', `${head('de')}- \`a.b\` X\u0000\n`, 'not-allowed'],
    ['a direction override', `${head('de')}- \`a.b\` X‮Y\n`, 'not-allowed'],
    ['a level-3 heading', `${head('de')}### X\n`, 'bad-line'],
    ['a text too long', `${head('de')}- \`a.b\` ${'x'.repeat(301)}\n`, 'too-large'],
  ])('rejects %s', (_name, text, code) => {
    const r = parseUiFile(uiPath('de'), text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.code)).toContain(code);
    expect(r.errors[0]?.file).toBe('content/locales/de/ui.md');
  });

  it('rejects hostile input without throwing: wrong path, not text, huge', () => {
    for (const [path, text] of [
      ['content/locales/de/strings.md', head('de')],
      ['content/locales/../ui.md', head('de')],
      [42, head('de')],
      [uiPath('de'), null],
      [uiPath('de'), { length: 3 }],
      [uiPath('de'), `${head('de')}${'- `a.b` x\n'.repeat(MAX_UI_FILE_BYTES / 8)}`],
    ] as const) {
      expect(parseUiFile(path, text).ok).toBe(false);
    }
  });

  it('finds the values in a text', () => {
    expect(placeholdersOf('Шаг {step} из {count}, {step}')).toEqual(['count', 'step']);
    expect(placeholdersOf('no values')).toEqual([]);
  });
});

describe('fill', () => {
  it('puts values in and leaves unknown names as they are', () => {
    expect(fill('Step {step} of {count}', { step: 3, count: 5 })).toBe('Step 3 of 5');
    expect(fill('Step {step}', {})).toBe('Step {step}');
    expect(fill('{constructor}{toString}', {})).toBe('{constructor}{toString}');
    expect(fill('x {a}', { a: '{b}', b: 'no' })).toBe('x {b}');
    expect(fill('plain')).toBe('plain');
  });
});

describe('parseLanguages', () => {
  it('reads the real list: Russian, then English (M2.3b)', () => {
    const text = readFileSync(
      new URL('../../../content/locales/languages.md', import.meta.url),
      'utf8',
    );
    const r = parseLanguages(text);
    expect(r.ok && r.languages).toEqual([
      { code: 'ru', name: 'Русский' },
      { code: 'en', name: 'English' },
    ]);
  });

  it('reads languages in order, base first', () => {
    const r = parseLanguages(`${LANGS}- \`en\` English\n`);
    expect(r.ok && r.languages.map((l) => l.code)).toEqual(['ru', 'en']);
  });

  it.each([
    ['missing', null],
    ['no header', '# L\n\n- `ru` Русский\n'],
    ['base not first', '# L\n\n`languages` · `format` 1\n\n- `en` English\n- `ru` Русский\n'],
    ['a duplicate', `${LANGS}- \`ru\` Ещё\n`],
    ['a bad code', `${LANGS}- \`EN\` English\n`],
    ['no name', `${LANGS}- \`en\`\n`],
    ['markup in the name', `${LANGS}- \`en\` <b>English</b>\n`],
    ['empty list', '# L\n\n`languages` · `format` 1\n'],
  ])('rejects %s', (_name, text) => {
    expect(parseLanguages(text).ok).toBe(false);
  });
});

describe('checkLocales (S9, K94)', () => {
  const ru = { path: uiPath('ru'), text: ruText };
  const en = { path: uiPath('en'), text: enText };

  it('passes the real files: ru on the site, en checked but not on the site yet', () => {
    const r = checkLocales({
      languages: { text: LANGS },
      ui: [ru, en],
      lessonPaths: ['content/lessons/B1/ru.md', 'content/lessons/I1/ru.md'],
    });
    expect(r.errors).toEqual([]);
    expect(r.languages.map((l) => l.code)).toEqual(['ru']);
    expect(Object.keys(r.strings)).toEqual(['ru']);
    expect(r.strings['ru']?.['app.tagline']).toBe('Как устроены атаки и как от них защититься');
  });

  it('S9: a site language without one lesson and one key fails and names each', () => {
    const withoutKey = enText.replace(/^- `defence\.isOff` .*\n/m, '');
    const r = checkLocales({
      languages: { text: `${LANGS}- \`en\` English\n` },
      ui: [ru, { path: uiPath('en'), text: withoutKey }],
      lessonPaths: [
        'content/lessons/B1/ru.md',
        'content/lessons/B1/en.md',
        'content/lessons/I1/ru.md',
      ],
    });
    const lines = r.errors.map(formatError);
    expect(lines).toContain(
      'content/lessons/I1/en.md:1:1: lesson I1 has no en.md: every site language has every lesson (K94)',
    );
    expect(
      lines.some((l) =>
        l.startsWith(
          'content/locales/en/ui.md:1:1: missing key defence.isOff (content/locales/ru/ui.md:',
        ),
      ),
    ).toBe(true);
    expect(lines).toHaveLength(2);
    expect(r.strings).toEqual({});
  });

  it('S9 as written: de in the list, one lesson and one key missing, unknown headings named too', () => {
    const de = `${head('de')}${ruText
      .split('\n')
      .filter((l) => l.startsWith('- `') && !l.startsWith('- `app.tagline`'))
      .join('\n')}\n`;
    const r = checkLocales({
      languages: { text: `${LANGS}- \`de\` Deutsch\n` },
      ui: [ru, { path: uiPath('de'), text: de }],
      lessonPaths: [
        'content/lessons/B1/ru.md',
        'content/lessons/B1/de.md',
        'content/lessons/I1/ru.md',
      ],
    });
    const lines = r.errors.map(formatError).join('\n');
    expect(lines).toContain('content/lessons/I1/de.md:1:1: lesson I1 has no de.md');
    expect(lines).toContain('content/locales/de/ui.md:1:1: missing key app.tagline');
    expect(lines).toContain('content/locales/languages.md:1:1: de needs its lesson headings');
    expect(lines).not.toContain('B1/de.md');
  });

  it('a site language without ui.md fails; a translation with an extra key or other values fails', () => {
    const noUi = checkLocales({
      languages: { text: `${LANGS}- \`en\` English\n` },
      ui: [ru],
      lessonPaths: [],
    });
    expect(noUi.errors.map(formatError)).toEqual([
      'content/locales/en/ui.md:1:1: en is a site language: add content/locales/en/ui.md with every key of content/locales/ru/ui.md (K94)',
    ]);
    const extra = enText
      .replace('- `app.tagline` How', '- `app.slogan` Extra\n- `app.tagline` How')
      .replace('Step {step} of {count}', 'Step {step} of {total}');
    const r = checkLocales({
      languages: { text: LANGS },
      ui: [ru, { path: uiPath('en'), text: extra }],
      lessonPaths: [],
    });
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain('unknown-key');
    expect(codes).toContain('translation-mismatch');
  });

  it('needs languages.md and the Russian strings', () => {
    expect(checkLocales({ languages: null, ui: [ru], lessonPaths: [] }).errors[0]?.file).toBe(
      'content/locales/languages.md',
    );
    expect(
      checkLocales({ languages: { text: LANGS }, ui: [], lessonPaths: [] }).errors.map(
        (e) => e.code,
      ),
    ).toEqual(['missing-ui']);
  });
});

describe('aroundPlaceholder (OPEN1)', () => {
  it('splits a sentence around the first {name}', () => {
    expect(aroundPlaceholder('Idea — {link}: a protocol.', 'link')).toEqual({
      before: 'Idea — ',
      after: ': a protocol.',
    });
    expect(aroundPlaceholder('{link}', 'link')).toEqual({ before: '', after: '' });
    expect(aroundPlaceholder('{link} and {link}', 'link')).toEqual({
      before: '',
      after: ' and {link}',
    });
  });

  it('is null without the placeholder, also for a different name', () => {
    expect(aroundPlaceholder('No link here.', 'link')).toBeNull();
    expect(aroundPlaceholder('See {other}.', 'link')).toBeNull();
    expect(aroundPlaceholder('', 'link')).toBeNull();
  });

  it('finds {link} in both sentences with a link, in every site language', () => {
    for (const lang of ['ru', 'en']) {
      const text = readFileSync(uiPath(lang), 'utf8');
      for (const key of ['about.genre', 'about.help.text']) {
        const line = text.split('\n').find((l) => l.startsWith(`- \`${key}\` `));
        expect(line, `${lang} ${key}`).toBeDefined();
        expect(aroundPlaceholder(line ?? '', 'link'), `${lang} ${key}`).not.toBeNull();
      }
    }
  });
});
