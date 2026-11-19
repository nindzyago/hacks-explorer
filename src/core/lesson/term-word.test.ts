// M2.4 (K98): `term:<id>` at the end of a participant or zone line links it to a glossary term;
// the site data carries it and the lesson text may hold `term` nodes.
import { describe, expect, it } from 'vitest';
import { checkContent, checkLesson } from './check';
import validRu from './fixtures/valid-ru.md?raw';
import validEn from './fixtures/valid-en.md?raw';
import { readSiteLesson } from './site-read';
import { toSiteLesson } from './site';

const FILE = 'content/lessons/X1/ru.md';
const DOMAINS = ['owasp.org', 'mitre.org'];
const SOURCES = { path: 'content/sources.md', text: '- `owasp.org` OWASP\n- `mitre.org` MITRE\n' };

function check(text: string) {
  return checkLesson(FILE, text, { sourceDomains: DOMAINS });
}
function withLine(text: string, start: string, tail: string): string {
  const re = new RegExp(`^(${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*)$`, 'm');
  if (!re.test(text)) throw new Error(`no line ${start}`);
  return text.replace(re, `$1${tail}`);
}

describe('`term:` on participants', () => {
  it('reads the term; without it the term is null', () => {
    const { lesson, errors } = check(withLine(validRu, '- `attacker`', ' · `term:attacker`'));
    expect(errors).toEqual([]);
    expect(lesson?.participants[0]).toMatchObject({
      id: 'attacker',
      term: 'attacker',
      icon: 'attacker',
    });
    expect(lesson?.participants[1]?.term).toBeNull();
  });

  it('takes icon and term in any order', () => {
    for (const tail of [' · `icon:mail` · `term:inbox`', ' · `term:inbox` · `icon:mail`']) {
      const { lesson, errors } = check(withLine(validRu, '- `attacker`', tail));
      expect(errors).toEqual([]);
      expect(lesson?.participants[0]).toMatchObject({ icon: 'mail', term: 'inbox' });
    }
  });

  it('rejects an unknown word, a word given twice and a bad id', () => {
    // The participant is dropped, so steps naming it also report `unknown-participant`.
    const codeOf = (tail: string) =>
      check(withLine(validRu, '- `attacker`', tail)).errors.map((e) => e.code)[0];
    expect(codeOf(' · `glossary:x`')).toBe('unknown-word');
    expect(codeOf(' · `danger`')).toBe('unknown-word');
    expect(codeOf(' · `term:a` · `term:b`')).toBe('duplicate');
    expect(codeOf(' · `term:Bad_Id`')).toBe('bad-value');
    expect(codeOf(' · `term:`')).toBe('bad-value');
  });
});

describe('`term:` on zones', () => {
  it('reads the term next to `danger`, in any order', () => {
    const zoneLine = validRu.split('\n').find((l) => l.startsWith('- `outside`')) ?? '';
    for (const tail of [' · `danger` · `term:internet`', ' · `term:internet` · `danger`']) {
      const { lesson, errors } = check(validRu.replace(zoneLine, `${zoneLine}${tail}`));
      expect(errors).toEqual([]);
      expect(lesson?.zones[0]).toMatchObject({ danger: true, term: 'internet' });
    }
    expect(check(validRu).lesson?.zones[0]?.term).toBeNull();
  });

  it('rejects `term` without a value and unknown words', () => {
    const zoneLine = validRu.split('\n').find((l) => l.startsWith('- `outside`')) ?? '';
    expect(
      check(validRu.replace(zoneLine, `${zoneLine} · \`term\``)).errors.map((e) => e.code),
    ).toEqual(['unknown-word']);
  });
});

describe('translations', () => {
  it('a translation must give the same `term:` words', () => {
    const ru = withLine(validRu, '- `attacker`', ' · `term:attacker`');
    const files = [
      { path: FILE, text: ru },
      { path: 'content/lessons/X1/en.md', text: validEn },
    ];
    expect(checkContent(files, SOURCES).errors.map((e) => e.code)).toEqual([
      'translation-mismatch',
    ]);
    const en = withLine(validEn, '- `attacker`', ' · `term:attacker`');
    expect(
      checkContent(
        [files[0] ?? { path: '', text: '' }, { path: files[1]?.path ?? '', text: en }],
        SOURCES,
      ).errors,
    ).toEqual([]);
  });
});

describe('site data', () => {
  const lesson = check(withLine(validRu, '- `attacker`', ' · `term:attacker`')).lesson;
  if (lesson === null) throw new Error('fixture broken');
  const site = toSiteLesson(lesson);
  const want = { id: 'X1', language: 'ru' };

  it('carries the term of participants and zones', () => {
    expect(site.participants[0]?.term).toBe('attacker');
    expect(site.zones[0]?.term).toBeNull();
    const read = readSiteLesson(JSON.parse(JSON.stringify(site)), want);
    expect(read.ok && read.value.participants[0]?.term).toBe('attacker');
  });

  it('reads term nodes in text and rejects a bad term id', () => {
    const withTerm = JSON.parse(JSON.stringify(site)) as {
      steps: { levels: { simple: unknown[] } }[];
    };
    const step = withTerm.steps[0];
    if (step === undefined) throw new Error('no step');
    step.levels.simple = [
      {
        type: 'paragraph',
        children: [{ type: 'term', id: 'sql', children: [{ type: 'text', value: 'SQL' }] }],
      },
    ];
    const read = readSiteLesson(withTerm, want);
    expect(read.ok && read.value.steps[0]?.levels.simple).toEqual(step.levels.simple);
    const bad = JSON.parse(JSON.stringify(withTerm).replace('"id":"sql"', '"id":"<b>"')) as unknown;
    expect(readSiteLesson(bad, want).ok).toBe(false);
  });

  it('older data without `term` reads as null; a bad term is bad data', () => {
    const raw = JSON.parse(JSON.stringify(site)) as { participants: Record<string, unknown>[] };
    delete raw.participants[0]?.['term'];
    const read = readSiteLesson(raw, want);
    expect(read.ok && read.value.participants[0]?.term).toBeNull();
    const first = raw.participants[0];
    if (first !== undefined) first['term'] = 'Not An Id';
    expect(readSiteLesson(raw, want).ok).toBe(false);
  });
});
