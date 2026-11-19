/**
 * The address of a place in a lesson (M2.2, architecture §5): `/<lang>/lesson/<id>#step-<n>[-defence]`.
 * Pure: reads and writes strings, knows nothing about the browser. The address is hostile input
 * (L0.2): every part is matched against the whole grammar, nothing is decoded, and what does not
 * match gives the defaults (a bad hash) or «unknown» (a bad path). See README.md.
 */
import { MAX_STEPS } from '../../core/player/player';

/** Where the reader is: the lesson, its language, the step of the current mode, the mode. */
export interface Place {
  readonly lang: string;
  readonly lesson: string;
  /** From 1; the player cuts it to the steps of the loaded lesson. */
  readonly step: number;
  readonly defence: boolean;
}

export type Route =
  /** `/`, `/<lang>`, `/<lang>/lesson`: the default lesson; the address is rewritten to it. */
  | { readonly kind: 'home'; readonly place: Place }
  | { readonly kind: 'lesson'; readonly place: Place }
  /** Any other path: the page says so and offers the way home (L0.1). */
  | { readonly kind: 'unknown' };

export interface AddressOptions {
  /** Languages the site has; a well-formed language not in the list becomes `fallback`. */
  readonly languages: readonly string[];
  readonly fallback: string;
  /** The lesson the home page opens. */
  readonly home: string;
}

/** Longer paths and hashes are not read at all. */
export const MAX_PATH_LENGTH = 64;
export const MAX_HASH_LENGTH = 32;

/** A language tag as in BCP 47, short form: `ru`, `en`, `pt-br`. Matched case-insensitively. */
const LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;
/** A lesson id, as the `lesson.open` command accepts it (upper case there). */
const LESSON = /^[A-Za-z][0-9]{1,3}$/;
const HASH = /^#step-([0-9]{1,4})(-defence)?$/;

function language(raw: string, options: AddressOptions): string {
  const lower = raw.toLowerCase();
  return options.languages.includes(lower) ? lower : options.fallback;
}

function readHash(hash: unknown): { step: number; defence: boolean } {
  const plain = { step: 1, defence: false };
  if (typeof hash !== 'string' || hash.length > MAX_HASH_LENGTH) return plain;
  const match = HASH.exec(hash);
  const digits = match?.[1];
  if (match === null || digits === undefined) return plain;
  const step = Math.min(MAX_STEPS, Math.max(1, Number.parseInt(digits, 10)));
  return { step, defence: match[2] !== undefined };
}

/** Reads `location.pathname` and `location.hash`; never throws. */
export function parseAddress(pathname: unknown, hash: unknown, options: AddressOptions): Route {
  if (typeof pathname !== 'string' || pathname.length > MAX_PATH_LENGTH) return { kind: 'unknown' };
  if (pathname === '' || pathname === '/') {
    return {
      kind: 'home',
      place: { lang: options.fallback, lesson: options.home, step: 1, defence: false },
    };
  }
  if (!pathname.startsWith('/')) return { kind: 'unknown' };
  const trimmed = pathname.endsWith('/') ? pathname.slice(1, -1) : pathname.slice(1);
  const parts = trimmed.split('/');
  const [lang, word, id] = parts;
  if (lang === undefined || !LANG.test(lang)) return { kind: 'unknown' };
  const site = language(lang, options);
  if (parts.length === 1 || (parts.length === 2 && word === 'lesson')) {
    return { kind: 'home', place: { lang: site, lesson: options.home, step: 1, defence: false } };
  }
  if (parts.length !== 3 || word !== 'lesson' || id === undefined || !LESSON.test(id)) {
    return { kind: 'unknown' };
  }
  return { kind: 'lesson', place: { lang: site, lesson: id.toUpperCase(), ...readHash(hash) } };
}

/**
 * Writes the address of `place`. Step 1 without defence has no hash, so a plain lesson link stays
 * short. A value that would not read back (not a lesson id, not a language) is replaced by a safe
 * one: a bad language by `ru`, a bad lesson by the language's home page.
 */
export function formatAddress(place: Place): string {
  const lang = LANG.test(place.lang) ? place.lang.toLowerCase() : 'ru';
  if (!LESSON.test(place.lesson)) return `/${lang}`;
  const whole = Number.isFinite(place.step) ? Math.floor(place.step) : 1;
  const step = Math.min(MAX_STEPS, Math.max(1, whole));
  const path = `/${lang}/lesson/${place.lesson.toUpperCase()}`;
  if (step === 1 && !place.defence) return path;
  return `${path}#step-${String(step)}${place.defence ? '-defence' : ''}`;
}
