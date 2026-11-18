// M1.4: what the explanation panel shows, without a browser (S3 runs it in one).
import { describe, expect, it } from 'vitest';
import type { SiteCode, SitePassport, SiteStep } from '../core/lesson/site';
import {
  codeAtDeep,
  DEPTH_TABS,
  levelText,
  passportRows,
  severityWord,
  tabAfterKey,
} from './explain';

const code = (text: string): SiteCode => ({
  type: 'code',
  lang: 'sql',
  segments: [{ text, marked: false }],
});
const para = (value: string) => [
  { type: 'paragraph' as const, children: [{ type: 'text' as const, value }] },
];

function step(over: Partial<SiteStep> & Pick<SiteStep, 'id'>): SiteStep {
  return {
    title: over.id,
    from: 'a',
    to: 'b',
    kind: 'attack',
    mode: 'both',
    stopped: false,
    icon: null,
    message: 'm',
    result: 'r',
    code: null,
    levels: { simple: para('s'), detailed: para('d'), deep: para('g') },
    ...over,
  };
}

describe('depth tabs', () => {
  it('are «Просто», «По шагам», «Глубже», the first one the default', () => {
    expect(DEPTH_TABS.map((t) => t.label)).toEqual(['Просто', 'По шагам', 'Глубже']);
    expect(DEPTH_TABS.map((t) => t.depth)).toEqual(['simple', 'steps', 'deep']);
  });

  it('pick the text of the level', () => {
    const s = step({ id: 'x' });
    expect(levelText(s, 'simple')).toBe(s.levels.simple);
    expect(levelText(s, 'steps')).toBe(s.levels.detailed);
    expect(levelText(s, 'deep')).toBe(s.levels.deep);
  });

  it.each([
    ['simple', 'ArrowRight', 'steps'],
    ['deep', 'ArrowRight', 'simple'],
    ['simple', 'ArrowLeft', 'deep'],
    ['steps', 'ArrowLeft', 'simple'],
    ['steps', 'ArrowDown', 'deep'],
    ['steps', 'ArrowUp', 'simple'],
    ['deep', 'Home', 'simple'],
    ['simple', 'End', 'deep'],
    ['simple', 'Enter', null],
    ['simple', ' ', null],
    ['simple', 'd', null],
  ] as const)('from %s the key %j moves to %s', (from, key, to) => {
    expect(tabAfterKey(from, key)).toBe(to);
  });
});

describe('code at «Глубже» (K72)', () => {
  const glue = step({
    id: 'glue',
    from: 'server',
    to: 'db',
    mode: 'without-defence',
    code: code('glued'),
  });
  const param = step({
    id: 'param',
    from: 'server',
    to: 'db',
    mode: 'with-defence',
    code: code('param'),
  });
  const trick = step({ id: 'trick', from: 'attacker', to: 'server', code: code('trick') });
  const answer = step({ id: 'answer', from: 'db', to: 'server', mode: 'without-defence' });
  const steps = [trick, glue, answer, param];

  it('shows the query before and after the defence for a one-mode step, «Без защиты» first', () => {
    expect(codeAtDeep(steps, glue)).toEqual([
      { label: 'Без защиты', code: glue.code, current: true },
      { label: 'С защитой', code: param.code, current: false },
    ]);
    expect(codeAtDeep(steps, param)).toEqual([
      { label: 'Без защиты', code: glue.code, current: false },
      { label: 'С защитой', code: param.code, current: true },
    ]);
  });

  it('shows only the own code of a step that plays in both modes', () => {
    expect(codeAtDeep(steps, trick)).toEqual([{ label: '', code: trick.code, current: true }]);
  });

  it('shows nothing for a step without code, even when its counterpart has some', () => {
    const empty = step({ id: 'e', from: 'server', to: 'db', mode: 'without-defence' });
    expect(codeAtDeep([empty, param], empty)).toEqual([]);
    expect(codeAtDeep(steps, answer)).toEqual([]);
  });

  it('shows the own code alone when no counterpart has code', () => {
    const lone = step({ id: 'l', from: 'x', to: 'y', mode: 'with-defence', code: code('l') });
    expect(codeAtDeep([...steps, lone], lone)).toEqual([
      { label: 'С защитой', code: lone.code, current: true },
    ]);
  });
});

describe('passport', () => {
  const empty: SitePassport = {
    cwe: [],
    owasp: [],
    attack: [],
    cvss: null,
    cves: [],
    severity: null,
    impact: null,
    defence: null,
    class: null,
  };

  it('names severity in Russian words', () => {
    expect(['low', 'medium', 'high', 'critical'].map((s) => severityWord(s as 'low'))).toEqual([
      'низкая',
      'средняя',
      'высокая',
      'критическая',
    ]);
  });

  it('lists the lines with a value, class first', () => {
    const rows = passportRows({
      ...empty,
      class: 'Инъекция',
      cwe: [89, 564],
      owasp: ['A03:2021'],
      severity: 'critical',
      impact: 'Вход',
      defence: 'Параметры',
    });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Класс', 'Инъекция'],
      ['CWE', 'CWE-89, CWE-564'],
      ['OWASP Top 10', 'A03:2021'],
      ['Тяжесть', 'критическая'],
      ['Что получает атакующий', 'Вход'],
      ['Защита', 'Параметры'],
    ]);
  });

  it('takes the class from a known CWE when the lesson has no class line', () => {
    expect(passportRows({ ...empty, cwe: [564, 89] })[0]).toEqual({
      key: 'class',
      label: 'Класс',
      value: 'SQL-инъекция',
    });
  });

  it('has no class line for an unknown CWE, and nothing at all for an empty passport', () => {
    expect(passportRows({ ...empty, cwe: [99999] }).map((r) => r.key)).toEqual(['cwe']);
    expect(passportRows({ ...empty, cwe: [Number('constructor')] }).map((r) => r.key)).toEqual([
      'cwe',
    ]);
    expect(passportRows(empty)).toEqual([]);
  });

  it('shows ATT&CK, CVE and CVSS when present', () => {
    const rows = passportRows({
      ...empty,
      attack: ['T1566', 'T1566.002'],
      cves: ['CVE-2021-44228'],
      cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    });
    expect(rows.map((r) => r.key)).toEqual(['attack', 'cves', 'cvss']);
    expect(rows[0]?.value).toBe('T1566, T1566.002');
  });
});
