import type { LessonError, LessonErrorCode, Position } from './types';

/** The most errors one file reports; the rest are counted in one closing error. */
export const MAX_ERRORS_PER_FILE = 100;

export interface Reporter {
  readonly file: string;
  readonly errors: LessonError[];
  add(at: Position, path: string, code: LessonErrorCode, message: string): void;
}

export function createReporter(file: string): Reporter {
  const errors: LessonError[] = [];
  return {
    file,
    errors,
    add(at, path, code, message) {
      errors.push({ file, line: at.line, column: at.column, path, code, message });
    },
  };
}

/** Keeps the first errors and replaces the rest with one `too-many-errors`. */
export function capErrors(errors: readonly LessonError[]): LessonError[] {
  if (errors.length <= MAX_ERRORS_PER_FILE) return [...errors];
  const kept = errors.slice(0, MAX_ERRORS_PER_FILE);
  const last = kept[kept.length - 1];
  kept.push({
    file: last?.file ?? '',
    line: last?.line ?? 1,
    column: last?.column ?? 1,
    path: '',
    code: 'too-many-errors',
    message: `and ${String(errors.length - MAX_ERRORS_PER_FILE)} more errors in this file`,
  });
  return kept;
}

export const START: Position = Object.freeze({ line: 1, column: 1 });

/** Line and column (1-based, UTF-16 units) of an index in `text`. */
export function positionAt(text: string, index: number): Position {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: index - lineStart + 1 };
}

/** Shortens a value quoted in a message, so a hostile file cannot make huge messages. */
export function quote(value: string, max = 60): string {
  const flat = value.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
