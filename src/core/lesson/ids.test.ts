// M2.8 (oracle A R6 R7): the passport names only real CWE, CVE, OWASP and ATT&CK ids, checked
// against vetted lists fetched from MITRE, NVD and OWASP (ids.ts). An unknown id stops the gate.
import { describe, expect, it } from 'vitest';
import { checkLesson } from './check';
import {
  ATTACK_TECHNIQUES,
  CVE_RECORDS,
  CWE_ENTRIES,
  ID_SOURCES,
  OWASP_ITEMS,
  unknownId,
} from './ids';
import type { LessonError } from './types';
import validRu from './fixtures/valid-ru.md?raw';
import unknownCwe from './fixtures/s8-unknown-cwe.md?raw';
import unknownCve from './fixtures/s8-unknown-cve.md?raw';
import unknownOwasp from './fixtures/s8-unknown-owasp.md?raw';
import unknownAttack from './fixtures/s8-unknown-attack.md?raw';

const FILE = 'content/lessons/X1/ru.md';
const check = (text: string, file = FILE) =>
  checkLesson(file, text, { sourceDomains: ['owasp.org', 'mitre.org'] });
const only = (errors: readonly LessonError[]) =>
  errors.map((e) => ({ line: e.line, path: e.path, code: e.code }));
/** Replace exactly one occurrence, so a test never silently checks the unchanged fixture. */
function edit(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`edit: need one "${from}"`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

describe('a lesson with an id that is not in the vetted lists fails (S8, L5)', () => {
  it.each([
    ['CWE', unknownCwe, 7, 'passport.cwe', 'CWE-5640'],
    ['OWASP', unknownOwasp, 8, 'passport.owasp', 'A01:2017'],
    ['ATT&CK', unknownAttack, 9, 'passport.attack', 'T1666'],
    ['CVE', unknownCve, 11, 'passport.cves', 'CVE-2021-44288'],
  ])('unknown %s', (_name, text, line, path, id) => {
    const result = check(text);
    expect(only(result.errors)).toEqual([{ line, path, code: 'unknown-id' }]);
    expect(result.errors[0]?.message).toContain(id);
    expect(result.errors[0]?.message).toContain('src/core/lesson/ids.ts');
    expect(result.lesson).toBe(null);
  });

  it('the valid fixture passes, so each failing fixture differs only by its id', () => {
    expect(check(validRu).errors).toEqual([]);
  });

  it('reports every unknown id on the line, not only the first', () => {
    const text = edit(validRu, '- `cwe` 89, 564', '- `cwe` 89, 5640, 77777');
    const messages = check(text).errors.map((e) => e.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('CWE-5640');
    expect(messages[1]).toContain('CWE-77777');
  });

  it.each([
    ['- `cwe` 89, 564', '- `cwe` 0'],
    ['- `cwe` 89, 564', '- `cwe` 089'],
    ['- `owasp` A03:2021', '- `owasp` A11:2021'],
    ['- `owasp` A03:2021', '- `owasp` LLM11:2025'],
    ['- `cves` CVE-2021-44228', '- `cves` CVE-1998-0001'],
    ['- `cves` CVE-2021-44228', '- `cves` CVE-3021-44228'],
    ['- `cves` CVE-2021-44228', '- `cves` CVE-2021-044228'],
    ['- `cves` CVE-2021-44228', '- `cves` CVE-2021-123'],
    ['- `cves` CVE-2021-44228', '- `cves` cve-2021-44228'],
  ])('rejects the form %s → %s', (from, to) => {
    expect(check(edit(validRu, from, to)).errors.map((e) => e.code)).toEqual(['bad-value']);
  });

  it.each([
    ['- `owasp` A03:2021', '- `owasp` A10:2021'],
    ['- `owasp` A03:2021', '- `owasp` LLM01:2025'],
    ['- `attack` T1190', '- `attack` T1566, T1566.002'],
    ['- `cves` CVE-2021-44228', '- `cves` CVE-2014-0160, CVE-2024-3094'],
  ])('accepts the vetted %s → %s', (from, to) => {
    expect(check(edit(validRu, from, to)).errors).toEqual([]);
  });

  it('an id that names an Object.prototype key is not known', () => {
    expect(unknownId('owasp', 'constructor')).not.toBe(null);
    expect(unknownId('attack', '__proto__')).not.toBe(null);
    expect(unknownId('cves', 'toString')).not.toBe(null);
  });
});

// B1 (CWE-89, A03:2021) and I1 (T1566, T1566.002) pass through scripts/content.test.mjs.

describe('the vetted lists match MITRE, NVD and OWASP (R6, R7)', () => {
  // Spot checks of the official names and dates as fetched (sources and dates in ID_SOURCES).
  it.each([
    [89, 'Improper Neutralization of Special Elements used in an SQL Command'],
    [79, 'Improper Neutralization of Input During Web Page Generation'],
    [22, 'Improper Limitation of a Pathname to a Restricted Directory'],
    [352, 'Cross-Site Request Forgery'],
    [918, 'Server-Side Request Forgery'],
    [564, 'Use of Hibernate with HQL/SQL Query String Containing External Input'],
  ])('CWE-%i is «%s»', (id, name) => {
    expect(CWE_ENTRIES.get(id)).toBe(name);
  });

  it.each([
    ['T1566', 'Phishing'],
    ['T1566.002', 'Phishing: Spearphishing Link'],
    ['T1190', 'Exploit Public-Facing Application'],
    ['T1557', 'Adversary-in-the-Middle'],
  ])('ATT&CK %s is «%s»', (id, name) => {
    expect(ATTACK_TECHNIQUES.get(id)).toBe(name);
  });

  it.each([
    ['A03:2021', 'Injection'],
    ['A10:2021', 'Server-Side Request Forgery (SSRF)'],
    ['LLM01:2025', 'Prompt Injection'],
  ])('OWASP %s is «%s»', (id, name) => {
    expect(OWASP_ITEMS.get(id)).toBe(name);
  });

  it.each([
    ['CVE-2021-44228', '2021-12-10'],
    ['CVE-2014-0160', '2014-04-07'],
    ['CVE-2017-0144', '2017-03-17'],
    ['CVE-2014-6271', '2014-09-24'],
    ['CVE-2017-5638', '2017-03-11'],
    ['CVE-2024-3094', '2024-03-29'],
  ])('%s was published by NVD on %s', (id, date) => {
    expect(CVE_RECORDS.get(id)).toBe(date);
  });

  it('OWASP Top 10:2021 and LLM Top 10:2025 are complete, ten items each', () => {
    const ids = [...OWASP_ITEMS.keys()];
    expect(ids.filter((id) => id.endsWith(':2021'))).toHaveLength(10);
    expect(ids.filter((id) => id.startsWith('LLM'))).toHaveLength(10);
  });

  it('every entry has the form the passport accepts and a non-empty name', () => {
    for (const [id, name] of CWE_ENTRIES) {
      expect(Number.isInteger(id) && id > 0).toBe(true);
      expect(name.trim()).not.toBe('');
    }
    for (const [id, name] of ATTACK_TECHNIQUES) {
      expect(id).toMatch(/^T\d{4}(\.\d{3})?$/);
      expect(name.trim()).not.toBe('');
      // A sub-technique is listed with its parent and named «Parent: Sub».
      const parent = id.split('.')[0] ?? '';
      if (id.includes('.'))
        expect(name.startsWith(`${ATTACK_TECHNIQUES.get(parent) ?? '?'}: `)).toBe(true);
    }
    for (const [id, date] of CVE_RECORDS) {
      expect(id).toMatch(/^CVE-(1999|20\d\d)-(\d{4}|[1-9]\d{4,6})$/);
      expect(date).toMatch(/^\d{4}-\d\d-\d\d$/);
      expect(date.slice(0, 4) >= id.slice(4, 8)).toBe(true);
    }
  });

  it('records where and when each list was fetched', () => {
    for (const source of Object.values(ID_SOURCES)) {
      expect(source.url).toMatch(/^[a-z.-]+\.(org|gov)\//);
      expect(source.fetched).toBe('2026-11-19');
      expect(source.version.trim()).not.toBe('');
    }
  });
});
