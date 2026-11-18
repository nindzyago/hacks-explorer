// Hostile lesson files (AGENTS.md L0.2, design §5 «Враждебный файл»): errors as data, never a throw.
import { describe, expect, it } from 'vitest';
import { checkContent, checkLesson } from './check';
import validRu from './fixtures/valid-ru.md?raw';

const FILE = 'content/lessons/X1/ru.md';
const check = (text: unknown, file: unknown = FILE) =>
  checkLesson(file, text, { sourceDomains: ['owasp.org'] });

describe('hostile input', () => {
  it('rejects a file over 64 KB without parsing it', () => {
    const big = validRu + '\nа'.repeat(600_000);
    const { lesson, errors } = check(big);
    expect(lesson).toBe(null);
    expect(errors).toEqual([expect.objectContaining({ code: 'too-large', line: 1, column: 1 })]);
  });

  it('rejects a file with thousands of * _ [ before parsing it (quadratic in the parser)', () => {
    const started = performance.now();
    const text = `${validRu}\n${'*_'.repeat(8000)}x${'_*'.repeat(8000)}`;
    expect(check(text).errors.map((e) => e.code)).toEqual(['too-complex']);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('counts the limit in bytes, not characters', () => {
    // 33 000 Cyrillic letters are 66 000 bytes in UTF-8.
    expect(check('я'.repeat(33_000)).errors.map((e) => e.code)).toEqual(['too-large']);
  });

  it.each([
    ['empty', ''],
    ['whitespace', '  \n\n\t'],
    ['binary', '\u0000\u0001�\uD800'],
    ['only a title', '# Урок'],
    ['deep quotes', '>'.repeat(60_000)],
    ['deep lists', Array.from({ length: 200 }, (_, i) => `${'  '.repeat(i)}- a`).join('\n')],
    ['deep emphasis', `## Паспорт\n\n- \`impact\` ${'*_'.repeat(10_000)}x${'_*'.repeat(10_000)}`],
    ['many steps', `## Шаги\n\n${'### `a` b\n\n'.repeat(4000)}`],
  ])('returns errors for %s input', (_name, text) => {
    const result = check(text);
    expect(result.lesson).toBe(null);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of result.errors) {
      expect(e.file).toBe(FILE);
      expect(Number.isInteger(e.line) && e.line >= 1).toBe(true);
      expect(Number.isInteger(e.column) && e.column >= 1).toBe(true);
    }
  });

  it.each([undefined, null, 42, {}, ['# a']])('rejects text that is not a string: %j', (text) => {
    expect(check(text).errors.map((e) => e.code)).toEqual(['parse-failed']);
  });

  it('rejects a file name that is not a string', () => {
    expect(check(validRu, 7).errors.map((e) => e.code)).toEqual(['bad-path']);
  });

  it('does not let __proto__ become an id; constructor is just a name', () => {
    for (const id of ['__proto__', 'toString']) {
      const text = validRu.replace('- `site` **Сайт** — shop.example', `- \`${id}\` **x**`);
      expect(check(text).errors.map((e) => e.code)).toContain('bad-value');
    }
    const ctor = validRu.replaceAll('`site`', '`constructor`').replace('`site →', '`constructor →');
    const fixed = ctor.replaceAll('site →', 'constructor →').replaceAll('→ site', '→ constructor');
    const result = check(fixed);
    expect(result.errors).toEqual([]);
    expect(result.lesson?.participants[2]?.id).toBe('constructor');
    const word = validRu.replace('- `severity` high', '- `__proto__` high');
    expect(check(word).errors.map((e) => e.code)).toContain('unknown-word');
  });

  it('caps the number of errors per file', () => {
    const text = `${validRu}\n${'<b>x</b>\n\n'.repeat(5000)}`;
    const { errors } = check(text);
    expect(errors.length).toBeLessThanOrEqual(101);
    expect(errors.at(-1)?.message).toMatch(/more errors/);
  });

  it('checkContent survives hostile file lists', () => {
    const sources = { path: 'content/sources.md', text: '- `owasp.org` OWASP\n' };
    expect(() =>
      checkContent([{ path: 'content/lessons/X1/ru.md', text: '\u0000' }], sources),
    ).not.toThrow();
    const odd = [{ path: 'content/lessons/../../etc/ru.md', text: validRu }];
    expect(checkContent(odd, sources).errors.map((e) => e.code)).toEqual(['bad-path']);
  });
});
