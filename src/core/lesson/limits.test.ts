// M1.1c: the pre-parse limits (design E5, K32) pinned at the limit and one past it.
import { describe, expect, it } from 'vitest';
import {
  MAX_DELIMITERS,
  MAX_LESSON_BYTES,
  MAX_LINES,
  MAX_LINE_MARKERS,
  MAX_MARKER_INDENT,
  checkLesson,
} from './check';
import type { LessonError } from './types';
import validRu from './fixtures/valid-ru.md?raw';

const check = (text: string) =>
  checkLesson('content/lessons/X1/ru.md', text, { sourceDomains: ['owasp.org'] });
const codes = (errors: readonly LessonError[]) => errors.map((e) => e.code);
const PREFLIGHT = ['too-large', 'too-complex', 'too-deep'];
const preflight = (text: string) => codes(check(text).errors).filter((c) => PREFLIGHT.includes(c));
const utf8 = (text: string) => new TextEncoder().encode(text).length;

describe(`size: ${String(MAX_LESSON_BYTES)} bytes in UTF-8`, () => {
  /** The valid lesson with one more paragraph, `bytes` long in all. */
  const sized = (bytes: number, wide: boolean) => {
    const base = `${validRu}\n`;
    const room = bytes - utf8(base) - 1;
    const pad = wide ? 'я'.repeat(Math.floor(room / 2)) + 'a'.repeat(room % 2) : 'a'.repeat(room);
    const text = `${base}${pad}\n`;
    expect(utf8(text)).toBe(bytes);
    return text;
  };

  it.each([false, true])(
    'accepts exactly the limit and rejects one byte more (Cyrillic: %s)',
    (wide) => {
      expect(check(sized(MAX_LESSON_BYTES, wide)).errors).toEqual([]);
      expect(preflight(sized(MAX_LESSON_BYTES + 1, wide))).toEqual(['too-large']);
    },
  );
});

describe(`lines: ${String(MAX_LINES)}, counted as an editor numbers them`, () => {
  const lines = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  /** The valid lesson padded with empty lines to `n` lines; `terminated` — ends with a newline. */
  const padded = (n: number, terminated: boolean) => {
    const body = validRu.replace(/\n$/, '');
    const extra = n - lines(body);
    const text = terminated ? body + '\n'.repeat(extra + 1) : `${body}${'\n'.repeat(extra)}a`;
    expect(lines(text)).toBe(n);
    return text;
  };

  it.each([true, false])(
    'accepts the limit and rejects one line more (final newline: %s)',
    (end) => {
      expect(check(padded(MAX_LINES, end)).errors).toEqual([]);
      expect(preflight(padded(MAX_LINES + 1, end))).toEqual(['too-large']);
    },
  );
});

describe(`delimiters: ${String(MAX_DELIMITERS)} of * _ [ together`, () => {
  const own = (validRu.match(/[*_[]/g) ?? []).length;
  /** `n` delimiters in all, the added ones a mix of the three. */
  const mixed = (n: number) => {
    const add = n - own;
    return `${validRu}\n${'*_['.repeat(Math.floor(add / 3))}${'['.repeat(add % 3)}\n`;
  };

  it('accepts the limit and rejects one more', () => {
    expect(preflight(mixed(MAX_DELIMITERS))).toEqual([]);
    expect(preflight(mixed(MAX_DELIMITERS + 1))).toEqual(['too-complex']);
  });
});

describe(`markers: ${String(MAX_LINE_MARKERS)} per line, the last ending by column ${String(MAX_MARKER_INDENT)}`, () => {
  const line = (text: string) => `${validRu}\n${text}\n`;

  it.each([
    ['quotes', '> '.repeat(MAX_LINE_MARKERS), '> '.repeat(MAX_LINE_MARKERS + 1)],
    ['ordered list items', '1. '.repeat(MAX_LINE_MARKERS), '1. '.repeat(MAX_LINE_MARKERS + 1)],
    ['a quote then a list item', '> - ', '> - - '],
  ])('%s: accepts the limit and rejects one more', (_name, atLimit, over) => {
    expect(preflight(line(`${atLimit}a`))).toEqual([]);
    expect(preflight(line(`${over}a`))).toEqual(['too-deep']);
  });

  const end = MAX_MARKER_INDENT;
  it.each([
    ['a quote after spaces', ' '.repeat(end - 1) + '> a', ' '.repeat(end) + '> a'],
    ['a quote after tabs (4 columns each)', '\t'.repeat(3) + '   > a', '\t'.repeat(4) + '> a'],
    ['an ordered item', ' '.repeat(end - 2) + '1. a', ' '.repeat(end - 1) + '1. a'],
    ['a second marker', '>' + ' '.repeat(end - 2) + '> a', '>' + ' '.repeat(end - 1) + '> a'],
  ])(
    '%s: accepts a marker ending at the column and rejects one column further',
    (_name, ok, bad) => {
      expect(preflight(line(ok))).toEqual([]);
      expect(preflight(line(bad))).toEqual(['too-deep']);
    },
  );

  it('does not limit indentation without markers', () => {
    expect(preflight(line(' '.repeat(200) + 'a'))).toEqual([]);
  });
});
