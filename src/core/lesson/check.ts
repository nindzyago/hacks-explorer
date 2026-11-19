/**
 * Entry points of the lesson checker: one file (`checkLesson`) and all content
 * (`checkContent`). Pure: strings in, data out; never throws. Reading files is the caller's job
 * (scripts/). Behaviour and the format: README.md.
 */
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { BASE_LANGUAGE, knownLanguages, wordsFor } from './headings';
import type { ParsedLesson } from './parse';
import { parseLesson } from './parse';
import { START, capErrors, capReported, createReporter } from './report';
import { checkRules } from './rules';
import { parseSourceDomains } from './sources';
import { compareTranslation } from './translations';
import type { Lesson, LessonError } from './types';

/** A lesson file larger than this is rejected unread (design E5). */
export const MAX_LESSON_BYTES = 64 * 1024;
/**
 * Emphasis and link delimiters (`*`, `_`, `[`) per file. The Markdown parser spends quadratic
 * time on long runs of them (16 000 take over a second); 2 000 take about 50 ms, and a real
 * lesson has a few dozen.
 */
export const MAX_DELIMITERS = 2000;
/**
 * Lines per file. The parser is slow on some constructs that need many lines (16 000 setext
 * headings take 14 s); B1 has about 220 lines.
 */
export const MAX_LINES = 1000;
/**
 * Quote and list markers at the start of one line, and the column the last one may stand in.
 * Deep nesting is slow to parse: 64 000 `>` take 4 s; 2 000 lines of `- - - - a` 0.9 s;
 * an ordered list nested 200 levels by indentation 0.4 s. Lessons nest two or three levels.
 */
export const MAX_LINE_MARKERS = 2;
export const MAX_MARKER_INDENT = 16;

/** Drops a leading BOM and turns CRLF and lone CR into LF; lines and columns stay as editors show them. */
export function normaliseText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/**
 * Cheap limits checked before the Markdown parser runs, so no input can make it slow. `what`
 * names the file in messages (the glossary uses the same limits, M2.4).
 */
export function preflight(
  text: string,
  what = 'a lesson',
): { code: 'too-large' | 'too-complex' | 'too-deep'; line: number; message: string } | null {
  const bytes = utf8Length(text);
  if (bytes > MAX_LESSON_BYTES) {
    return {
      code: 'too-large',
      line: 1,
      message: `the file is ${String(bytes)} bytes; ${what} is at most ${String(MAX_LESSON_BYTES)}`,
    };
  }
  const lines = text.split('\n');
  // A final newline ends the last line; it does not start one more.
  const lineCount = lines.length - (text.endsWith('\n') ? 1 : 0);
  if (lineCount > MAX_LINES) {
    return {
      code: 'too-large',
      line: 1,
      message: `the file has ${String(lineCount)} lines; ${what} has at most ${String(MAX_LINES)}`,
    };
  }
  const delimiters = text.match(/[*_[]/g)?.length ?? 0;
  if (delimiters > MAX_DELIMITERS) {
    return {
      code: 'too-complex',
      line: 1,
      message: `the file has ${String(delimiters)} of the characters * _ [; ${what} has at most ${String(MAX_DELIMITERS)}`,
    };
  }
  for (let i = 0; i < lines.length; i += 1) {
    const { markers, width } = containerPrefix(lines[i] ?? '');
    if (markers > MAX_LINE_MARKERS || (markers > 0 && width > MAX_MARKER_INDENT)) {
      return {
        code: 'too-deep',
        line: i + 1,
        message: `quote and list markers nest too deep on this line; at most ${String(MAX_LINE_MARKERS)} markers within the first ${String(MAX_MARKER_INDENT)} columns`,
      };
    }
  }
  return null;
}

/**
 * The quote and list markers that open a line (`> - 1. `) and the columns they take, tab = 4.
 * Stops early: only whether the limits are crossed matters.
 */
function containerPrefix(line: string): { markers: number; width: number } {
  let markers = 0;
  let width = 0;
  /** The column where the last marker ends. */
  let end = 0;
  let i = 0;
  while (i < line.length && markers <= MAX_LINE_MARKERS && width <= MAX_MARKER_INDENT * 2) {
    const c = line[i];
    if (c === ' ') width += 1;
    else if (c === '\t') width += 4;
    else if (c === '>') {
      markers += 1;
      width += 1;
      end = width;
    } else {
      const marker = /^(?:[-+*]|\d{1,9}[.)])(?=[ \t]|$)/.exec(line.slice(i, i + 11))?.[0];
      if (marker === undefined) break;
      markers += 1;
      width += marker.length;
      end = width;
      i += marker.length;
      continue;
    }
    i += 1;
  }
  return { markers, width: end };
}

const LESSON_PATH = /^content\/lessons\/([A-Z][0-9]{1,2})\/([a-z]{2,3})\.md$/;

export interface CheckOptions {
  /** Domains source links may point at, from content/sources.md. */
  readonly sourceDomains: readonly string[];
}

export interface LessonResult {
  /** The lesson, only when there are no errors. */
  readonly lesson: Lesson | null;
  readonly errors: readonly LessonError[];
}

interface Checked extends LessonResult {
  readonly parsed: ParsedLesson | null;
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function checkOne(file: unknown, input: unknown, options: CheckOptions): Checked {
  const name = typeof file === 'string' ? file : '<not a file name>';
  const reporter = createReporter(name);
  const fail = (): Checked => ({ lesson: null, errors: capReported(reporter), parsed: null });
  const match = typeof file === 'string' ? LESSON_PATH.exec(file) : null;
  if (match === null) {
    reporter.add(
      START,
      '',
      'bad-path',
      'a lesson lives in content/lessons/<id>/<language>.md, id like B1',
    );
    return fail();
  }
  const [, id = '', language = ''] = match;
  const words = wordsFor(language);
  if (words === null) {
    reporter.add(
      START,
      '',
      'unknown-language',
      `unknown language "${language}"; known: ${knownLanguages().join(', ')} (src/core/lesson/headings.ts)`,
    );
    return fail();
  }
  if (typeof input !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return fail();
  }
  const text = normaliseText(input);
  const limit = preflight(text);
  if (limit !== null) {
    reporter.add({ line: limit.line, column: 1 }, '', limit.code, limit.message);
    return fail();
  }
  let root: Root;
  try {
    root = fromMarkdown(text);
  } catch {
    reporter.add(START, '', 'parse-failed', 'cannot read the file as Markdown');
    return fail();
  }
  const parsed = parseLesson(root, text, { id, language, words }, reporter);
  checkRules(parsed, text, reporter, { sourceDomains: options.sourceDomains, words });
  const errors = capReported(reporter);
  return { lesson: errors.length === 0 ? parsed.draft : null, errors, parsed };
}

/** Checks one lesson file. `file` is its path from the repository root. */
export function checkLesson(file: unknown, text: unknown, options: CheckOptions): LessonResult {
  const { lesson, errors } = checkOne(file, text, options);
  return { lesson, errors };
}

export interface ContentFile {
  readonly path: string;
  readonly text: string;
}

export interface ContentResult {
  /** Lessons without errors, in the order of `files`. */
  readonly lessons: readonly Lesson[];
  readonly errors: readonly LessonError[];
}

/**
 * Checks every file under content/lessons and the translations against ru.md.
 * `files` are all files found there; `sources` is content/sources.md.
 */
export function checkContent(files: readonly ContentFile[], sources: ContentFile): ContentResult {
  const errors: LessonError[] = [];
  const sourcesReporter = createReporter(sources.path);
  let sourceDomains: string[] = [];
  if (typeof sources.text !== 'string') {
    sourcesReporter.add(START, 'sources', 'parse-failed', 'the sources file is not text');
  } else {
    const text = normaliseText(sources.text);
    const limit = preflight(text);
    if (limit === null) sourceDomains = parseSourceDomains(text, sourcesReporter);
    else sourcesReporter.add({ line: limit.line, column: 1 }, 'sources', limit.code, limit.message);
  }
  errors.push(...capReported(sourcesReporter));

  const checked = files.map((f) => {
    const path = typeof f.path === 'string' ? f.path : '';
    const inLessons = /^content\/lessons\/[A-Za-z0-9]+\/[^/]+$/.test(path);
    if (inLessons && !path.endsWith('.md')) {
      const reporter = createReporter(path);
      reporter.add(
        START,
        '',
        'unexpected-file',
        'content/lessons/<id>/ holds only <language>.md files',
      );
      return { path, result: { lesson: null, errors: reporter.errors, parsed: null } };
    }
    return { path, result: checkOne(path, f.text, { sourceDomains }) };
  });

  const lessons: Lesson[] = [];
  for (const { path, result } of checked) {
    errors.push(...result.errors);
    const lesson = result.lesson;
    if (lesson === null) continue;
    if (lesson.language !== BASE_LANGUAGE) {
      const basePath = path.replace(/[^/]+\.md$/, `${BASE_LANGUAGE}.md`);
      const base = checked.find((c) => c.path === basePath);
      if (base === undefined) {
        const reporter = createReporter(path);
        reporter.add(START, '', 'missing-base', `a translation needs ${basePath} next to it`);
        errors.push(...reporter.errors);
        continue;
      }
      if (base.result.lesson === null) continue; // ru.md has its own errors; compare once it is fixed
      const reporter = createReporter(path);
      compareTranslation(base.result.lesson, lesson, reporter, {
        header: result.parsed?.anchors.header ?? START,
        passport: result.parsed?.anchors.sections.passport ?? START,
      });
      errors.push(...capErrors(reporter.errors));
      if (reporter.errors.length > 0) continue;
    }
    lessons.push(lesson);
  }
  return { lessons, errors };
}

/** `file:line:column: message` — the form editors and terminals turn into links. */
export function formatError(error: LessonError): string {
  return `${error.file}:${String(error.line)}:${String(error.column)}: ${error.message}`;
}
