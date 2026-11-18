// Fixes after the first verifier pass of M1.1a: title, plain-text fields, speed limits, BOM and
// line endings, translation details, source URLs.
import { describe, expect, it } from 'vitest';
import {
  MAX_DELIMITERS,
  MAX_LINES,
  MAX_LINE_MARKERS,
  MAX_MARKER_INDENT,
  checkContent,
  checkLesson,
} from './check';
import type { LessonError } from './types';
import validRu from './fixtures/valid-ru.md?raw';
import validEn from './fixtures/valid-en.md?raw';

const FILE = 'content/lessons/X1/ru.md';
const check = (text: unknown) => checkLesson(FILE, text, { sourceDomains: ['owasp.org'] });
const codes = (errors: readonly LessonError[]) => errors.map((e) => e.code);
function edit(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`edit: need one "${from}"`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

describe('the title is plain text', () => {
  it.each([
    ['emphasis', '# Атака *на практике*', 'not-allowed'],
    ['strong', '# Атака **x**', 'not-allowed'],
    ['HTML', '# Атака <b>x</b>', 'html'],
    ['an image', '# Атака ![i](x.png)', 'image'],
    ['a link', '# Атака [x](https://owasp.org)', 'link'],
    ['code', '# Атака `x`', 'not-allowed'],
  ])('rejects %s in the title', (_name, title, code) => {
    const { errors, lesson } = check(edit(validRu, '# Учебная атака', title));
    expect(lesson).toBe(null);
    expect(errors.find((e) => e.line === 1)).toMatchObject({ code, path: 'title' });
  });

  it('never stores a NUL character', () => {
    const { lesson } = check(edit(validRu, '# Учебная атака', '# Учебная\u0000атака'));
    expect(JSON.stringify(lesson ?? '')).not.toContain('\\u0000');
  });
});

describe('single-line fields are plain text (design E5: HTML anywhere is an error)', () => {
  const html = '<script>alert(1)</script>';
  const img = '<img src=x onerror=alert(1)>';
  it.each([
    ['participant name', '**Атакующий**', `**Атакующий ${html}**`, 'html'],
    ['participant note', '— 203.0.113.66', `— 203.0.113.66 ${img}`, 'html'],
    ['participant note link', '— 203.0.113.66', '— [ссылка](https://owasp.org)', 'link'],
    ['participant note image', '— 203.0.113.66', '— ![i](a.png)', 'image'],
    ['zone label', 'Снаружи:', `Снаружи ${html}:`, 'html'],
    ['zone label link', 'Снаружи:', '[Снаружи](https://owasp.org):', 'link'],
    ['impact', '`impact` Чужие данные', `\`impact\` Чужие данные ${img}`, 'html'],
    ['defence', '`defence` Проверка на сервере', '`defence` [Проверка](https://owasp.org)', 'link'],
    ['message', 'Сообщение: письмо', `Сообщение: письмо ${html}`, 'html'],
    ['result', 'Итог: доставлено', 'Итог: ![i](a.png)', 'image'],
    ['result emphasis', 'Итог: доставлено', 'Итог: *доставлено*', 'not-allowed'],
    ['escaped HTML-looking text', 'Итог: доставлено', 'Итог: &lt;b&gt;', 'html'],
  ])('rejects markup in the %s', (_name, from, to, code) => {
    const { errors, lesson } = check(edit(validRu, from, to));
    expect(lesson).toBe(null);
    expect(codes(errors)).toContain(code);
  });
});

describe('speed: any input up to 64 KB is checked well under a second', () => {
  const cases: [string, string][] = [
    ['setext h1 headings', 'a\n=\n'.repeat(16_000)],
    ['setext h2 after a valid lesson', validRu + 'a\n-\n\n'.repeat(10_000)],
    ['64 KB of >', '>'.repeat(64_000)],
    ['nested quotes line by line', Array.from({ length: 300 }, (_, i) => '>'.repeat(i)).join('\n')],
    ['64 KB of foreign domains', 'evil.org '.repeat(7_000)],
    ['64 KB of foreign IPs', '8.8.8.8 '.repeat(8_000)],
    ['lines', 'a\n'.repeat(32_000)],
    ['ordered list', '1. a\n'.repeat(12_000)],
    ['indented code', '    a\n'.repeat(10_000)],
    ['brackets', `${'['.repeat(1_999)}${']('.repeat(20_000)}`],
    ['64 KB of hex digits and colons', '1:'.repeat(32_000)],
  ];
  it.each(cases)(
    '%s',
    (_name, text) => {
      const started = performance.now();
      const result = check(text);
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeLessThanOrEqual(101);
    },
    3_000,
  );

  it(`accepts ${String(MAX_DELIMITERS)} of * _ [ and rejects one more`, () => {
    const at = (n: number) =>
      `${validRu}\n${'_'.repeat(n - (validRu.match(/[*_[]/g) ?? []).length)}\n`;
    expect(codes(check(at(MAX_DELIMITERS)).errors)).not.toContain('too-complex');
    expect(codes(check(at(MAX_DELIMITERS + 1)).errors)).toEqual(['too-complex']);
  });

  it(`accepts ${String(MAX_LINES)} lines and rejects one more`, () => {
    // validRu ends with a newline: its last line is complete, the split's empty tail is no line.
    const lines = validRu.split('\n').length - 1;
    const at = (n: number) => validRu + '\n'.repeat(n - lines);
    expect(check(at(MAX_LINES)).errors).toEqual([]);
    expect(codes(check(at(MAX_LINES + 1)).errors)).toEqual(['too-large']);
  });

  it('rejects quotes nested deeper than the text allows, before parsing', () => {
    expect(codes(check(`${validRu}\n${'> '.repeat(9)}a\n`).errors)).toEqual(['too-deep']);
  });

  it(`allows ${String(MAX_LINE_MARKERS)} markers on a line and rejects one more`, () => {
    const at = (n: number) => `${validRu}\n${'- '.repeat(n)}a\n`;
    expect(codes(check(at(MAX_LINE_MARKERS)).errors)).not.toContain('too-deep');
    expect(check(at(MAX_LINE_MARKERS + 1)).errors[0]).toMatchObject({
      code: 'too-deep',
      line: validRu.split('\n').length + 1,
    });
  });

  it(`rejects a list marker beyond column ${String(MAX_MARKER_INDENT)} but not indented code`, () => {
    const nested = (indent: number) =>
      edit(validRu, 'Сайт отказывает.', `- a\n${' '.repeat(indent)}- b`);
    expect(codes(check(nested(MAX_MARKER_INDENT - 1)).errors)).not.toContain('too-deep');
    expect(codes(check(nested(MAX_MARKER_INDENT)).errors)).toEqual(['too-deep']);
    const code = edit(validRu, 'GET /?q=', `${' '.repeat(40)}GET /?q=`);
    expect(check(code).errors).toEqual([]);
  });
});

describe('line endings and BOM', () => {
  it('ignores a leading BOM', () => {
    expect(check(`\uFEFF${validRu}`).errors).toEqual([]);
  });

  it('reads CRLF and lone CR files with the same lines', () => {
    const crlf = validRu.replace(/\n/g, '\r\n');
    const cr = validRu.replace(/\n/g, '\r');
    expect(check(crlf).errors).toEqual([]);
    expect(check(cr).errors).toEqual([]);
    const bad = edit(validRu, 'адрес 192.0.2.10', 'адрес 8.8.8.8');
    const lfError = check(bad).errors[0];
    expect(check(bad.replace(/\n/g, '\r')).errors[0]).toEqual(lfError);
    expect(check(`\uFEFF${bad.replace(/\n/g, '\r\n')}`).errors[0]).toEqual(lfError);
  });
});

describe('translations compare every service detail', () => {
  const sources = { path: 'content/sources.md', text: '- `owasp.org` OWASP\n' };
  const ru = { path: 'content/lessons/X1/ru.md', text: validRu };
  const en = (text: string) =>
    checkContent([ru, { path: 'content/lessons/X1/en.md', text }], sources);
  it.each([
    ['step icon', '`attacker → site` · `attack` · `icon:mail`', '`attacker → site` · `attack`'],
    ['passport cves', '- `cves` CVE-2021-44228', '- `cves` CVE-2021-44229'],
  ])('rejects an en.md that differs in %s', (_name, from, to) => {
    expect(codes(en(edit(validEn, from, to)).errors)).toEqual(['translation-mismatch']);
  });

  // A lesson without attack steps may omit the defence name and «How to defend» on its own, so
  // only the comparison with ru.md can catch a translation that drops them.
  const plainRu = {
    path: 'content/lessons/X1/ru.md',
    text: validRu.replaceAll('· `attack`', '· `legit`'),
  };
  const plainEn = validEn.replaceAll('· `attack`', '· `legit`');
  const plain = (text: string) =>
    checkContent([plainRu, { path: 'content/lessons/X1/en.md', text }], sources);

  it('accepts the plain lesson pair', () => {
    expect(plain(plainEn).errors).toEqual([]);
  });

  it('rejects a translation without the defence name that ru.md has', () => {
    const noName = edit(plainEn, '- `defence` Server-side check\n', '');
    expect(codes(plain(noName).errors)).toEqual(['translation-mismatch']);
  });

  it('rejects a translation without the defence section that ru.md has', () => {
    const cut = plainEn.slice(0, plainEn.indexOf('## How to defend'));
    expect(codes(plain(cut).errors)).toEqual(['translation-mismatch']);
  });
});

describe('source links', () => {
  it.each([
    ['userinfo', 'https://user:pw@cheatsheetseries.owasp.org/index.html'],
    ['a user name only', 'https://evil@cheatsheetseries.owasp.org/index.html'],
    ['a port', 'https://cheatsheetseries.owasp.org:8443/index.html'],
  ])('rejects %s', (_name, url) => {
    const text = edit(validRu, 'https://cheatsheetseries.owasp.org/index.html', url);
    expect(codes(check(text).errors)).toEqual(['source-domain']);
  });

  it('does not take a source title that names a real host for an address', () => {
    const text = edit(validRu, '[OWASP Cheat Sheet]', '[cheatsheetseries.owasp.org]');
    expect(check(text).errors).toEqual([]);
  });

  it('reports a sources file that is not text with a fitting code', () => {
    const result = checkContent([{ path: FILE, text: validRu }], {
      path: 'content/sources.md',
      text: 42 as unknown as string,
    });
    expect(result.errors[0]).toMatchObject({ file: 'content/sources.md', code: 'parse-failed' });
  });
});
