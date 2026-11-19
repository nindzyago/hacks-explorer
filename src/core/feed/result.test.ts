// M1.5 verifier notes: a message payload keeps its words together.
import { describe, expect, it } from 'vitest';
import { keepTogether } from './result';

describe('keepTogether', () => {
  it('joins the words of a payload with no-break spaces', () => {
    expect(keepTogether("параметр: admin' --")).toBe("параметр: admin' --");
    expect(keepTogether('a \t b')).toBe('a b');
    expect(keepTogether('')).toBe('');
  });
});
