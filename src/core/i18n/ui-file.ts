/**
 * The interface strings of one language: `content/locales/<lang>/ui.md` (M2.3 E2, K105). A
 * Markdown file read line by line, so every line means exactly one thing:
 *
 *   # <any title>
 *   `ui` <lang> · `format` 1
 *   ## <a group, for the translator>
 *   - `<key>` <text>
 *
 * Other lines are notes for translators and are ignored; a line that starts like a list item or a
 * heading must be one of the above. Text is plain: `{name}` is a value put in by the code, nothing
 * else is special. The file is hostile input (a pull request): every error is data with the line,
 * never an exception. Build time only.
 */
import { createReporter, capReported, START } from '../lesson/report';
import type { LessonError } from '../lesson/types';

export const UI_FORMAT = 1;
/** A ui.md larger than this is not read at all. */
export const MAX_UI_FILE_BYTES = 64 * 1024;
export const MAX_UI_TEXT_LENGTH = 300;
export const MAX_UI_KEYS = 1000;

/** `app.tagline`, `cwe.89`: two or more parts, the first a word. */
export const UI_KEY = /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+){1,4}$/;
const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]{0,31})\}/g;
/**
 * NUL, other control characters (tab aside) and the characters that turn text direction (K98):
 * the text must read as it is written.
 */
export function hasHiddenCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09) || c === 0x7f || c === 0x200e || c === 0x200f) return true;
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true;
  }
  return false;
}

/** A byte order mark at the start of a file is not part of its text. */
export function withoutBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
const TAG_LIKE = /<[a-zA-Z/!?]/;
const ENTRY = /^- \x60([^\x60]*)\x60(?:[ \t]+(.*))?$/;
const HEADER = /^\x60ui\x60 ([a-z]{2,3}) · \x60format\x60 ([0-9]+)$/;
const PATH = /^content\/locales\/([a-z]{2,3})\/ui\.md$/;

export interface UiEntry {
  readonly text: string;
  readonly line: number;
  /** The names of `{…}` in the text, sorted, each once. */
  readonly placeholders: readonly string[];
}

export interface UiFile {
  readonly path: string;
  readonly language: string;
  /** In file order. */
  readonly entries: ReadonlyMap<string, UiEntry>;
}

export type UiFileResult =
  | { readonly ok: true; readonly file: UiFile }
  | { readonly ok: false; readonly errors: readonly LessonError[] };

export function uiPath(language: string): string {
  return `content/locales/${language}/ui.md`;
}

/** The names of the `{…}` values in `text`, sorted, each once. */
export function placeholdersOf(text: string): readonly string[] {
  return [...new Set(Array.from(text.matchAll(PLACEHOLDER), (m) => m[1] ?? ''))].sort();
}

/** Text with every `{name}` taken out: what is left must hold no brace. */
function withoutPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER, '');
}

export function parseUiFile(path: unknown, text: unknown): UiFileResult {
  const file = typeof path === 'string' ? path : '';
  const reporter = createReporter(file);
  const failed = (): UiFileResult => ({ ok: false, errors: capReported(reporter) });
  const where = PATH.exec(file);
  if (where === null) {
    reporter.add(START, '', 'bad-path', 'interface strings live in content/locales/<lang>/ui.md');
    return failed();
  }
  const language = where[1] ?? '';
  if (typeof text !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return failed();
  }
  if (text.length > MAX_UI_FILE_BYTES) {
    reporter.add(START, '', 'too-large', `larger than ${String(MAX_UI_FILE_BYTES)} bytes`);
    return failed();
  }
  const lines = withoutBom(text).split(/\r?\n/);
  const entries = new Map<string, UiEntry>();
  let title = false;
  let header = false;
  for (const [i, raw] of lines.entries()) {
    const line = i + 1;
    const at = { line, column: 1 };
    const content = raw.trim();
    if (content === '') continue;
    if (hasHiddenCharacter(raw)) {
      reporter.add(at, '', 'not-allowed', 'control and text-direction characters are not allowed');
      continue;
    }
    if (!title) {
      if (!content.startsWith('# ') || content.length < 3) {
        reporter.add(at, '', 'missing-title', 'the file starts with a title line: # <title>');
        return failed();
      }
      title = true;
      continue;
    }
    if (!header) {
      const m = HEADER.exec(content);
      const want = `\`ui\` ${language} · \`format\` ${String(UI_FORMAT)}`;
      if (m === null || m[1] !== language || m[2] !== String(UI_FORMAT)) {
        reporter.add(at, 'header', 'bad-header', `the line after the title is: ${want}`);
        return failed();
      }
      header = true;
      continue;
    }
    if (content.startsWith('#')) {
      if (!/^## \S/.test(content)) {
        reporter.add(at, '', 'bad-line', 'only one # title and ## groups are allowed');
      }
      continue;
    }
    if (!content.startsWith('-') && !content.startsWith('*') && !content.startsWith('+')) continue;
    const m = ENTRY.exec(content);
    if (m === null) {
      reporter.add(at, '', 'bad-line', 'a string looks like - `key.name` Text');
      continue;
    }
    const key = m[1] ?? '';
    const value = (m[2] ?? '').trim();
    if (!UI_KEY.test(key)) {
      reporter.add(at, key, 'bad-value', `"${key.slice(0, 60)}" is not a key like app.tagline`);
      continue;
    }
    if (entries.has(key)) {
      reporter.add(
        at,
        key,
        'duplicate',
        `${key} is already on line ${String(entries.get(key)?.line)}`,
      );
      continue;
    }
    if (value === '') {
      reporter.add(at, key, 'bad-value', `${key} has no text`);
      continue;
    }
    if (value.length > MAX_UI_TEXT_LENGTH) {
      reporter.add(
        at,
        key,
        'too-large',
        `${key}: at most ${String(MAX_UI_TEXT_LENGTH)} characters`,
      );
      continue;
    }
    if (TAG_LIKE.test(value)) {
      reporter.add(at, key, 'html', `${key}: HTML is not allowed; write plain text`);
      continue;
    }
    if (/[{}]/.test(withoutPlaceholders(value))) {
      reporter.add(at, key, 'bad-value', `${key}: braces only around a value name, like {count}`);
      continue;
    }
    if (entries.size >= MAX_UI_KEYS) {
      reporter.add(at, key, 'too-large', `at most ${String(MAX_UI_KEYS)} keys`);
      break;
    }
    entries.set(key, { text: value, line, placeholders: placeholdersOf(value) });
  }
  if (!title)
    reporter.add(START, '', 'missing-title', 'the file starts with a title line: # <title>');
  else if (!header) {
    reporter.add(START, 'header', 'bad-header', `a header line \`ui\` ${language} · \`format\` 1`);
  }
  if (reporter.total() > 0) return failed();
  return { ok: true, file: { path: file, language, entries } };
}
