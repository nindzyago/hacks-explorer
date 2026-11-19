// M2.3 (K96, K105): the interface strings at run time and the choice of language for a visitor.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUiFile, uiPath } from '../../core/i18n/ui-file';
import {
  chooseLanguage,
  formatNumber,
  readLocales,
  rememberLanguage,
  STORAGE_KEY,
  storedLanguage,
  translator,
  type LanguageStorage,
} from './i18n';
import { UI_KEYS } from './keys';

function strings(lang: string): Record<string, string> {
  const path = uiPath(lang);
  const parsed = parseUiFile(
    path,
    readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'),
  );
  if (!parsed.ok) throw new Error(`${path} has errors`);
  return Object.fromEntries([...parsed.file.entries].map(([k, e]) => [k, e.text]));
}

const ru = strings('ru');
const en = strings('en');
const bundle = {
  languages: [
    { code: 'ru', name: 'Русский' },
    { code: 'en', name: 'English' },
  ],
  strings: { ru, en },
};

describe('UI_KEYS', () => {
  it('are exactly the keys of content/locales/ru/ui.md, in its order', () => {
    expect([...UI_KEYS]).toEqual(Object.keys(ru));
  });
});

describe('readLocales', () => {
  it('reads the bundled strings of every site language', () => {
    const r = readLocales(bundle);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.languages.map((l) => l.code)).toEqual(['ru', 'en']);
    const t = translator(r.value.strings['en'] ?? new Map());
    expect(t('defence.isOff')).toBe('Defence is off');
    expect(t('player.status', { step: 3, count: 5 })).toBe('Step 3 of 5');
  });

  it('rejects data without a key, a language or with the wrong shapes', () => {
    const short = Object.fromEntries(Object.entries(en).filter(([k]) => k !== 'defence.isOff'));
    for (const bad of [
      null,
      [],
      { languages: [], strings: {} },
      { languages: [{ code: 'ru', name: 'Русский' }], strings: {} },
      { ...bundle, strings: { ru, en: short } },
      { ...bundle, strings: { ru, en: { ...en, 'app.tagline': 7 } } },
      { languages: [{ code: '__proto__', name: 'x' }], strings: { __proto__: ru } },
      { languages: [{ code: 'RU', name: 'x' }], strings: { RU: ru } },
    ]) {
      expect(readLocales(bad).ok).toBe(false);
    }
  });
});

describe('translator', () => {
  it('fills values and writes numbers the language way', () => {
    const r = readLocales(bundle);
    if (!r.ok) throw new Error(r.error.message);
    const tRu = translator(r.value.strings['ru'] ?? new Map());
    const tEn = translator(r.value.strings['en'] ?? new Map());
    expect(tRu('steps.goto', { number: 2, title: 'Вход' })).toBe('Шаг 2: Вход');
    expect(formatNumber(tRu, 0.5)).toBe('0,5');
    expect(formatNumber(tEn, 0.5)).toBe('0.5');
    expect(formatNumber(tEn, 2)).toBe('2');
  });
});

describe('chooseLanguage (D3, K96)', () => {
  const both = ['ru', 'en'];
  it.each([
    [['ru-RU'], 'ru'],
    [['uk-UA'], 'ru'],
    [['be'], 'ru'],
    [['kk-KZ', 'en'], 'ru'],
    [['en-US'], 'en'],
    [['de-DE'], 'en'],
    [['de-DE', 'ru'], 'ru'],
    [['EN-gb'], 'en'],
    [[], 'en'],
  ])('browser %j → %s', (browser, want) => {
    expect(chooseLanguage({ stored: null, browser, languages: both })).toBe(want);
  });

  it('prefers what the reader chose before, if the site has it', () => {
    expect(chooseLanguage({ stored: 'en', browser: ['ru'], languages: both })).toBe('en');
    expect(chooseLanguage({ stored: 'de', browser: ['ru'], languages: both })).toBe('ru');
  });

  it('ignores hostile stored and browser values', () => {
    for (const stored of [
      '__proto__',
      'constructor',
      'RU',
      ' en',
      'en\u0000',
      7,
      {},
      'x'.repeat(1e5),
    ]) {
      expect(chooseLanguage({ stored, browser: ['ru'], languages: both })).toBe('ru');
    }
    for (const browser of [null, 'ru', [7, null, {}], ['x'.repeat(100)], { 0: 'en', length: 1 }]) {
      expect(chooseLanguage({ stored: null, browser, languages: both })).toBe('en');
    }
  });

  it('is Russian while the site has only Russian', () => {
    expect(chooseLanguage({ stored: 'en', browser: ['en-US'], languages: ['ru'] })).toBe('ru');
  });
});

describe('the remembered language', () => {
  function memory(): LanguageStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
  }

  it('is written and read back', () => {
    const m = memory();
    rememberLanguage(() => m, 'en');
    expect(m.data.get(STORAGE_KEY)).toBe('en');
    expect(storedLanguage(() => m)).toBe('en');
  });

  it('survives a storage that is missing or throws', () => {
    const throwing: LanguageStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(storedLanguage(() => throwing)).toBeNull();
    expect(() => {
      rememberLanguage(() => throwing, 'en');
    }).not.toThrow();
    expect(storedLanguage(() => null)).toBeNull();
    expect(
      storedLanguage(() => {
        throw new Error('no localStorage');
      }),
    ).toBeNull();
  });
});
