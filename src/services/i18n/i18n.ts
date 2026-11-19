/**
 * The interface strings at run time (M2.3, K105). The build bundles the strings of every site
 * language into the page (`virtual:site-locales`, scripts/lesson-data.ts): about 3 KB gzip a
 * language, available before the first paint, so `t` is synchronous. `readLocales` checks the
 * bundled data like any other input (L0.2); the gate already made it complete (K94), so a missing
 * key cannot reach the reader.
 *
 * Also the choice of language for a visitor (D3, K96): the address wins, then the language the
 * reader chose before (`localStorage`), then the browser's languages.
 */
import { fill, type Say } from '../../core/i18n/say';
import type { ReadResult } from '../../core/lesson/site-read';
import { fail, field, list, object, read, str } from '../../core/lesson/site-read';
import { UI_KEYS, type UiKey } from './keys';

export type Translate = Say<UiKey>;
/** Every key of UI_KEYS, checked by `readLocales`. */
export type UiStrings = ReadonlyMap<UiKey, string>;

export interface LocaleInfo {
  readonly code: string;
  /** The language's own name: «Русский», «English». */
  readonly name: string;
}

export interface Locales {
  /** Base language first. */
  readonly languages: readonly LocaleInfo[];
  readonly strings: Readonly<Record<string, UiStrings>>;
}

const CODE = /^[a-z]{2,3}$/;
/** The browser languages that read Russian on this site (D3: Ukrainian, Belarusian, Kazakh). */
const READS_RUSSIAN = new Set(['ru', 'uk', 'be', 'kk']);
export const STORAGE_KEY = 'hacks-explorer.language';

/** The bundled locales, checked: every site language has every key as a string. */
export function readLocales(input: unknown): ReadResult<Locales> {
  return read(input, (value) => {
    const root = object(value, '$');
    const languages = list(field(root, 'languages'), '$.languages', (item, path) => {
      const o = object(item, path);
      const code = str(o, 'code', path);
      if (!CODE.test(code)) fail(`${path}.code`, 'a language code like en');
      return { code, name: str(o, 'name', path) };
    });
    if (languages.length === 0) fail('$.languages', 'at least one language');
    const all = object(field(root, 'strings'), '$.strings');
    const strings: Record<string, UiStrings> = {};
    for (const { code } of languages) {
      const own = object(field(all, code), `$.strings.${code}`);
      strings[code] = new Map(UI_KEYS.map((key) => [key, str(own, key, `$.strings.${code}`)]));
    }
    return { languages, strings };
  });
}

export function translator(strings: UiStrings): Translate {
  // Every key is there (readLocales); the key itself is only a last resort that shows.
  return (key, params) => fill(strings.get(key) ?? key, params);
}

/** A number as the language writes it: `0,5` in Russian, `0.5` in English. */
export function formatNumber(t: Translate, n: number): string {
  return String(n).replace('.', t('format.decimal'));
}

function asLanguage(value: unknown, languages: readonly string[]): string | null {
  if (typeof value !== 'string' || value.length > 3) return null;
  return languages.includes(value) ? value : null;
}

/**
 * The language for a reader without one in the address (D3, K96, K105): the one they chose
 * before, if the site has it; else the first browser language the site has (Ukrainian,
 * Belarusian and Kazakh read Russian); else English; else the first site language.
 */
export function chooseLanguage(options: {
  readonly stored: unknown;
  readonly browser: unknown;
  readonly languages: readonly string[];
}): string {
  const { languages } = options;
  const stored = asLanguage(options.stored, languages);
  if (stored !== null) return stored;
  const browser = Array.isArray(options.browser) ? options.browser.slice(0, 20) : [];
  for (const tag of browser) {
    if (typeof tag !== 'string' || tag.length > 35) continue;
    const primary = (tag.split('-')[0] ?? '').toLowerCase();
    if (languages.includes(primary)) return primary;
    if (READS_RUSSIAN.has(primary) && languages.includes('ru')) return 'ru';
  }
  if (languages.includes('en')) return 'en';
  return languages[0] ?? 'ru';
}

/** The parts of `localStorage` used; it may be missing or throw (private mode, blocked). */
export interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What the reader chose before, or null; never throws. */
export function storedLanguage(storage: () => LanguageStorage | null): unknown {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Remembers the reader's language; a storage that throws is ignored. */
export function rememberLanguage(storage: () => LanguageStorage | null, language: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode or blocked storage: the address still holds the language.
  }
}
