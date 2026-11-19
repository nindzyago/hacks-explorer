// M4.3, oracle level D (S4: a link opens the same place, and says what it is): the title and
// description of a page are made from the lesson's own data and the interface strings.
import { describe, expect, it } from 'vitest';
import { sayFromFile } from '../i18n/testing';
import type { Say } from '../i18n/say';
import { fill } from '../i18n/say';
import { MAX_DESCRIPTION_LENGTH, clip, lessonDescription, lowerFirstWord, pageTitle } from './meta';

const say = (template: string): Say<'meta.lesson.description'> => {
  return (_key, params) => fill(template, params);
};
const passport = {
  class: 'Injection into a database query',
  impact: 'Logging in as someone else',
  defence: 'Parameterized query',
};

describe('pageTitle', () => {
  it('names the page, then the project', () => {
    expect(pageTitle('SQL injection')).toBe('SQL injection — Hacks Explorer');
  });
  it('is the project name alone without a page name', () => {
    expect(pageTitle(null)).toBe('Hacks Explorer');
    expect(pageTitle('   ')).toBe('Hacks Explorer');
  });
  it('keeps hostile text as text, in one line', () => {
    expect(pageTitle('<b>\n x </b>')).toBe('<b> x </b> — Hacks Explorer');
  });
});

describe('lessonDescription', () => {
  it('is the class, the impact and the defence in the template of the language', () => {
    expect(lessonDescription(passport, say('{class}. {impact}. How to stop it: {defence}.'))).toBe(
      'Injection into a database query. Logging in as someone else. How to stop it: parameterized query.',
    );
  });

  it('uses the real Russian and English templates', () => {
    const ru = lessonDescription(
      {
        class: 'Социальная инженерия',
        impact: 'Логин и пароль жертвы',
        defence: 'Менеджер паролей',
      },
      sayFromFile('ru'),
    );
    expect(ru).toBe(
      'Социальная инженерия. Логин и пароль жертвы. Как защититься: менеджер паролей.',
    );
    const en = lessonDescription(passport, sayFromFile('en'));
    expect(en).toBe(
      'Injection into a database query. Logging in as someone else. How to stop it: parameterized query.',
    );
  });

  it('does not double the final stop of a part', () => {
    expect(
      lessonDescription(
        { class: 'A class.', impact: 'An impact…', defence: 'A defence!' },
        say('{class}. {impact}. Defence: {defence}.'),
      ),
    ).toBe('A class. An impact. Defence: a defence.');
  });

  it('is null when a part is missing or empty, so the page falls back to the site description', () => {
    const t = say('{class}. {impact}. {defence}.');
    expect(lessonDescription({ ...passport, class: null }, t)).toBeNull();
    expect(lessonDescription({ ...passport, impact: '  ' }, t)).toBeNull();
    expect(lessonDescription({ ...passport, defence: '.' }, t)).toBeNull();
  });

  it(`stays within ${String(MAX_DESCRIPTION_LENGTH)} characters, cut at a word`, () => {
    const long = Array.from({ length: 80 }, () => 'word').join(' ');
    const text = lessonDescription(
      { ...passport, impact: long },
      say('{class}. {impact}. {defence}.'),
    );
    expect(text).not.toBeNull();
    expect(text?.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(text?.endsWith('word…')).toBe(true);
  });

  it('puts every part in one line', () => {
    expect(
      lessonDescription(
        { ...passport, impact: 'one\n\ttwo' },
        say('{class}. {impact}. {defence}.'),
      ),
    ).toBe('Injection into a database query. one two. parameterized query.');
  });
});

describe('lowerFirstWord', () => {
  it.each([
    ['Parameterized query', 'parameterized query'],
    ['Обновить библиотеку', 'обновить библиотеку'],
    ['Офлайн-копии и запрет макросов', 'офлайн-копии и запрет макросов'],
    ['Server-side owner check', 'server-side owner check'],
    ['A slow function', 'a slow function'],
  ])('lowers a plain capitalised first word: %s', (input, output) => {
    expect(lowerFirstWord(input)).toBe(output);
  });

  it.each(['HTTPS with HSTS', 'CSRF token', 'CSRF-токен', 'Log4j update', 'iOS update', 'MySQL'])(
    'keeps an acronym or a name with digits or inner capitals: %s',
    (input) => {
      expect(lowerFirstWord(input)).toBe(input);
    },
  );
});

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('short text', 20)).toBe('short text');
  });
  it('cuts at the last space and adds an ellipsis', () => {
    expect(clip('one two three four', 12)).toBe('one two…');
  });
  it('cuts a single long word hard', () => {
    expect(clip('a'.repeat(30), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});
