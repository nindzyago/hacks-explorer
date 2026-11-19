// M2.2, oracle level D (S4): the address of a place in a lesson, read and written. The address is
// hostile input (L0.2): anything that is not exactly the grammar gives defaults or «unknown»,
// never an exception.
import { describe, expect, it } from 'vitest';
import { formatAddress, parseAddress, pathLanguage, type Place } from './address';

// Verifier M2.3a (K110): «no such page» speaks the language of the address.
describe('pathLanguage', () => {
  it('reads a site language at the start of any path', () => {
    expect(pathLanguage('/en/nope', ['ru', 'en'])).toBe('en');
    expect(pathLanguage('/EN/lesson/B1/x', ['ru', 'en'])).toBe('en');
    expect(pathLanguage('/en', ['ru', 'en'])).toBe('en');
  });

  it('is null for anything else', () => {
    for (const path of ['/de/nope', '/nope', '/', '', 'en/nope', '/__proto__/x', 42, null]) {
      expect(pathLanguage(path, ['ru', 'en'])).toBeNull();
    }
    expect(pathLanguage(`/en/${'x'.repeat(100)}`, ['ru', 'en'])).toBeNull();
  });
});

const OPTIONS = { languages: ['ru'], fallback: 'ru', home: 'B1' } as const;
const parse = (path: unknown, hash: unknown = '') => parseAddress(path, hash, OPTIONS);
const place = (lesson: string, step = 1, defence = false, lang = 'ru'): Place => ({
  lang,
  lesson,
  step,
  defence,
});

describe('parseAddress', () => {
  it('reads the S4 address: lesson, step and defence', () => {
    expect(parse('/ru/lesson/B1', '#step-3-defence')).toEqual({
      kind: 'lesson',
      place: place('B1', 3, true),
    });
  });

  it('reads a step without defence and a lesson without a hash', () => {
    expect(parse('/ru/lesson/I1', '#step-2')).toEqual({ kind: 'lesson', place: place('I1', 2) });
    expect(parse('/ru/lesson/I1', '')).toEqual({ kind: 'lesson', place: place('I1') });
    expect(parse('/ru/lesson/I1', '#')).toEqual({ kind: 'lesson', place: place('I1') });
    expect(parse('/ru/lesson/K123')).toEqual({ kind: 'lesson', place: place('K123') });
  });

  it('the home page and a bare language are the default lesson', () => {
    for (const path of ['/', '', '/ru', '/ru/', '/ru/lesson', '/ru/lesson/']) {
      expect(parse(path), path).toEqual({ kind: 'home', place: place('B1') });
    }
  });

  it('forgives a trailing slash, a lower-case id and an upper-case language', () => {
    expect(parse('/ru/lesson/B1/', '#step-2')).toEqual({ kind: 'lesson', place: place('B1', 2) });
    expect(parse('/ru/lesson/b1')).toEqual({ kind: 'lesson', place: place('B1') });
    expect(parse('/RU/lesson/B1')).toEqual({ kind: 'lesson', place: place('B1') });
    expect(parse('/ru/LESSON/B1', '#step-2')).toEqual({ kind: 'lesson', place: place('B1', 2) });
    expect(parse('/ru/Lesson')).toEqual({ kind: 'home', place: place('B1') });
  });

  it('a well-formed language the site does not have falls back to the base language', () => {
    expect(parse('/en/lesson/B1', '#step-2')).toEqual({ kind: 'lesson', place: place('B1', 2) });
    expect(parse('/pt-br/lesson/B1')).toEqual({ kind: 'lesson', place: place('B1') });
    expect(parse('/de')).toEqual({ kind: 'home', place: place('B1') });
  });

  it('keeps a language the site has', () => {
    const both = { ...OPTIONS, languages: ['ru', 'en'] };
    expect(parseAddress('/en/lesson/B1', '#step-2', both)).toEqual({
      kind: 'lesson',
      place: place('B1', 2, false, 'en'),
    });
    expect(parseAddress('/en', '', both)).toEqual({
      kind: 'home',
      place: place('B1', 1, false, 'en'),
    });
  });

  it('step numbers are kept inside 1..100; the lesson cuts them further when it loads', () => {
    expect(parse('/ru/lesson/B1', '#step-0')).toEqual({ kind: 'lesson', place: place('B1', 1) });
    expect(parse('/ru/lesson/B1', '#step-007')).toEqual({ kind: 'lesson', place: place('B1', 7) });
    expect(parse('/ru/lesson/B1', '#step-9999-defence')).toEqual({
      kind: 'lesson',
      place: place('B1', 100, true),
    });
  });

  it('a hash outside the grammar gives step 1 without defence', () => {
    for (const hash of [
      '#step-',
      '#step--3',
      '#step-3.5',
      '#step-3-defense',
      '#step-3-defence-deep',
      '#step-1e3',
      '#step-٣',
      '#step-３',
      '#defence',
      '#STEP-3',
      '#step-3%2Ddefence',
      '#step-99999',
      `#step-3${'-defence'.repeat(50)}`,
      '#__proto__',
      '#constructor',
      'step-3',
    ]) {
      expect(parse('/ru/lesson/B1', hash), hash).toEqual({ kind: 'lesson', place: place('B1') });
    }
  });

  it('anything else in the path is an unknown page', () => {
    for (const path of [
      '/ru/lesson/__proto__',
      '/ru/lesson/constructor',
      '/ru/lesson/../B1',
      '/ru/lesson/..%2FB1',
      '/ru/lesson/%42%31',
      '/ru/lesson/B1%00',
      '/ru/lesson/B1/extra',
      '/ru/lesson/B',
      '/ru/lesson/B1234',
      '/ru/lesson/Б1',
      '/ru/lesson/B１',
      '/ru//lesson/B1',
      '//ru/lesson/B1',
      '/ru/lessons/B1',
      '/ru/catalog',
      '/русский/lesson/B1',
      '/r/lesson/B1',
      '/__proto__/lesson/B1',
      '/index.html',
      '/data/catalog.json',
      `/ru/lesson/${'B1'.repeat(5000)}`,
      `/${'a/'.repeat(1000)}`,
      'ru/lesson/B1',
      // Without the leading slash, dropping the first character would read a valid address.
      'xru/lesson/B1',
      'x/ru/lesson/B1',
      '/ru/lessonx/B1',
      '/ru/lesson/B1 ',
      '/ru/lesson/ B1',
    ]) {
      expect(parse(path), path).toEqual({ kind: 'unknown' });
    }
  });

  it('values that are not strings are the defaults or unknown, never an exception', () => {
    for (const value of [undefined, null, 3, {}, [], Symbol('x'), () => '/']) {
      expect(parse(value), typeof value).toEqual({ kind: 'unknown' });
      expect(parse('/ru/lesson/B1', value)).toEqual({ kind: 'lesson', place: place('B1') });
    }
  });
});

describe('formatAddress', () => {
  it('writes the S4 address', () => {
    expect(formatAddress(place('B1', 3, true))).toBe('/ru/lesson/B1#step-3-defence');
  });

  it('step 1 without defence has no hash; with defence it does', () => {
    expect(formatAddress(place('B1'))).toBe('/ru/lesson/B1');
    expect(formatAddress(place('B1', 1, true))).toBe('/ru/lesson/B1#step-1-defence');
    expect(formatAddress(place('I1', 4))).toBe('/ru/lesson/I1#step-4');
  });

  it('round-trips through parseAddress', () => {
    for (const each of [
      place('B1'),
      place('B1', 3, true),
      place('K12', 100),
      place('I1', 1, true),
    ]) {
      const address = formatAddress(each);
      const cut = address.indexOf('#');
      const path = cut < 0 ? address : address.slice(0, cut);
      const hash = cut < 0 ? '' : address.slice(cut);
      expect(parse(path, hash)).toEqual({ kind: 'lesson', place: each });
    }
  });

  it('never writes what it would not read back: bad values become safe ones', () => {
    expect(formatAddress(place('B1', 0))).toBe('/ru/lesson/B1');
    expect(formatAddress(place('B1', Number.NaN))).toBe('/ru/lesson/B1');
    expect(formatAddress(place('B1', 2.7))).toBe('/ru/lesson/B1#step-2');
    expect(formatAddress(place('B1', 1e9))).toBe('/ru/lesson/B1#step-100');
    expect(formatAddress(place('../x', 2))).toBe('/ru');
    expect(formatAddress(place('B1', 2, false, '../'))).toBe('/ru/lesson/B1#step-2');
  });
});
