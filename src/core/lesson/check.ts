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
import { START, capErrors, createReporter } from './report';
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

function checkOne(file: unknown, text: unknown, options: CheckOptions): Checked {
  const name = typeof file === 'string' ? file : '<not a file name>';
  const reporter = createReporter(name);
  const fail = (): Checked => ({ lesson: null, errors: capErrors(reporter.errors), parsed: null });
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
  if (typeof text !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return fail();
  }
  const bytes = utf8Length(text);
  if (bytes > MAX_LESSON_BYTES) {
    reporter.add(
      START,
      '',
      'too-large',
      `the file is ${String(bytes)} bytes; a lesson is at most ${String(MAX_LESSON_BYTES)}`,
    );
    return fail();
  }
  const delimiters = text.match(/[*_[]/g)?.length ?? 0;
  if (delimiters > MAX_DELIMITERS) {
    reporter.add(
      START,
      '',
      'too-complex',
      `the file has ${String(delimiters)} of the characters * _ [; a lesson has at most ${String(MAX_DELIMITERS)}`,
    );
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
  const sorted = [...reporter.errors].sort((a, b) => a.line - b.line || a.column - b.column);
  const errors = capErrors(sorted);
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
  const sourceDomains =
    typeof sources.text === 'string' && utf8Length(sources.text) <= MAX_LESSON_BYTES
      ? parseSourceDomains(sources.text, sourcesReporter)
      : [];
  if (sourceDomains.length === 0 && sourcesReporter.errors.length === 0) {
    sourcesReporter.add(
      START,
      'sources',
      'too-large',
      'the sources file is not readable text up to 64 KB',
    );
  }
  errors.push(...capErrors(sourcesReporter.errors));

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
