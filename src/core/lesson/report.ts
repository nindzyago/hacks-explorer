import type { LessonError, LessonErrorCode, Position } from './types';

/** The most errors one file reports; the rest are counted in one closing error. */
export const MAX_ERRORS_PER_FILE = 100;

/** A reporter keeps at most this many errors and only counts the rest, so a hostile file cannot
 * make it collect and sort hundreds of thousands. */
const MAX_KEPT = 1000;

export interface Reporter {
  readonly file: string;
  readonly errors: LessonError[];
  /** All errors reported, kept or not. */
  readonly total: () => number;
  add(at: Position, path: string, code: LessonErrorCode, message: string): void;
}

export function createReporter(file: string): Reporter {
  const errors: LessonError[] = [];
  let total = 0;
  return {
    file,
    errors,
    total: () => total,
    add(at, path, code, message) {
      total += 1;
      if (errors.length < MAX_KEPT) {
        errors.push({ file, line: at.line, column: at.column, path, code, message });
      }
    },
  };
}

/**
 * Sorts by line and column, keeps the first `MAX_ERRORS_PER_FILE` and replaces the rest with one
 * `too-many-errors`. `total` counts errors a reporter did not keep.
 */
export function capErrors(errors: readonly LessonError[], total = errors.length): LessonError[] {
  const sorted = [...errors].sort((a, b) => a.line - b.line || a.column - b.column);
  if (total <= MAX_ERRORS_PER_FILE) return sorted;
  const kept = sorted.slice(0, MAX_ERRORS_PER_FILE);
  const last = kept[kept.length - 1];
  kept.push({
    file: last?.file ?? '',
    line: last?.line ?? 1,
    column: last?.column ?? 1,
    path: '',
    code: 'too-many-errors',
    message: `and ${String(total - MAX_ERRORS_PER_FILE)} more errors in this file`,
  });
  return kept;
}

export function capReported(reporter: Reporter): LessonError[] {
  return capErrors(reporter.errors, reporter.total());
}

export const START: Position = Object.freeze({ line: 1, column: 1 });

/** Line and column (1-based, UTF-16 units) of an index in `text`; built once, O(log n) a call. */
export function createLocator(text: string): (index: number) => Position {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] ?? 0) <= index) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: index - (starts[lo] ?? 0) + 1 };
  };
}

/** Shortens a value quoted in a message, so a hostile file cannot make huge messages. */
export function quote(value: string, max = 60): string {
  const flat = value.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
