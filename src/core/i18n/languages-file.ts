/**
 * The languages of the site: `content/locales/languages.md` (M2.3, K94, K105). Every language in
 * this list has every lesson, every interface string and the glossary; the gate checks it. A
 * language with files but not in the list is checked for what it has and is not on the site.
 *
 *   # <any title>
 *   `languages` · `format` 1
 *   - `ru` Русский
 *   - `en` English
 *
 * The base language (ru) comes first. Other lines are notes and are ignored. Build time only.
 */
import { BASE_LANGUAGE } from '../lesson/headings';
import { createReporter, capReported, START } from '../lesson/report';
import type { LessonError } from '../lesson/types';
import { hasHiddenCharacter, withoutBom } from './ui-file';

export const LANGUAGES_PATH = 'content/locales/languages.md';
export const MAX_LANGUAGES = 20;
const MAX_NAME_LENGTH = 40;
const MAX_FILE_BYTES = 8 * 1024;
const HEADER = /^\x60languages\x60 · \x60format\x60 1$/;
const ENTRY = /^- \x60([^\x60]*)\x60(?:[ \t]+(.*))?$/;
export const LANGUAGE_CODE = /^[a-z]{2,3}$/;
const MARKUP = /[<>{}]/;

export interface SiteLanguage {
  /** `ru`, `en`: the folder name and the first part of the address. */
  readonly code: string;
  /** The language's own name for itself: `Русский`, `English`. */
  readonly name: string;
}

export type LanguagesResult =
  | { readonly ok: true; readonly languages: readonly SiteLanguage[] }
  | { readonly ok: false; readonly errors: readonly LessonError[] };

export function parseLanguages(text: unknown): LanguagesResult {
  const reporter = createReporter(LANGUAGES_PATH);
  const failed = (): LanguagesResult => ({ ok: false, errors: capReported(reporter) });
  if (typeof text !== 'string') {
    reporter.add(START, '', 'parse-failed', `${LANGUAGES_PATH} is missing or not text`);
    return failed();
  }
  if (text.length > MAX_FILE_BYTES) {
    reporter.add(START, '', 'too-large', `larger than ${String(MAX_FILE_BYTES)} bytes`);
    return failed();
  }
  const languages: SiteLanguage[] = [];
  let title = false;
  let header = false;
  for (const [i, raw] of withoutBom(text).split(/\r?\n/).entries()) {
    const at = { line: i + 1, column: 1 };
    const content = raw.trim();
    if (content === '') continue;
    if (!title) {
      if (!content.startsWith('# ')) {
        reporter.add(at, '', 'missing-title', 'the file starts with a title line: # <title>');
        return failed();
      }
      title = true;
      continue;
    }
    if (!header) {
      if (!HEADER.test(content)) {
        reporter.add(
          at,
          'header',
          'bad-header',
          'the line after the title is: `languages` · `format` 1',
        );
        return failed();
      }
      header = true;
      continue;
    }
    if (content.startsWith('#')) {
      reporter.add(at, '', 'bad-line', 'only one # title is allowed');
      continue;
    }
    if (!content.startsWith('-') && !content.startsWith('*') && !content.startsWith('+')) continue;
    const m = ENTRY.exec(content);
    const code = m?.[1] ?? '';
    const name = (m?.[2] ?? '').trim();
    if (m === null || !LANGUAGE_CODE.test(code) || name === '' || name.length > MAX_NAME_LENGTH) {
      reporter.add(at, '', 'bad-line', 'a language looks like - `en` English (its own name)');
      continue;
    }
    if (MARKUP.test(name) || hasHiddenCharacter(name)) {
      reporter.add(at, code, 'not-allowed', 'the name is plain text');
      continue;
    }
    if (languages.some((l) => l.code === code)) {
      reporter.add(at, code, 'duplicate', `${code} is already in the list`);
      continue;
    }
    if (languages.length >= MAX_LANGUAGES) {
      reporter.add(at, code, 'too-large', `at most ${String(MAX_LANGUAGES)} languages`);
      break;
    }
    languages.push({ code, name });
  }
  if (!title || !header) {
    reporter.add(START, 'header', 'bad-header', 'a title and the line `languages` · `format` 1');
  } else if (languages[0]?.code !== BASE_LANGUAGE) {
    reporter.add(START, '', 'bad-value', `the base language ${BASE_LANGUAGE} comes first`);
  }
  if (reporter.total() > 0) return failed();
  return { ok: true, languages };
}
