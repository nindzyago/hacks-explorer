/**
 * What the explanation panel shows (M1.4, S3): the step's text at the chosen depth, its code at
 * «Глубже», the lesson passport and sources. Pure functions over site data, tested without a
 * browser; the Svelte components only draw what these return. Never HTML (K37).
 */
import { type CvssSeverity, formatScore, scoreCvss31 } from '../core/cvss/cvss';
import type { SiteBlock, SiteCode, SitePassport, SiteStep } from '../core/lesson/site';
import type { Severity } from '../core/lesson/types';
import type { Depth } from '../core/state';

export interface DepthTab {
  readonly depth: Depth;
  readonly label: string;
}

/** The tabs in their order; the first is the default (K71). */
export const DEPTH_TABS: readonly DepthTab[] = [
  { depth: 'simple', label: 'Просто' },
  { depth: 'steps', label: 'По шагам' },
  { depth: 'deep', label: 'Глубже' },
];

/** The text of `step` at `depth`; «По шагам» is the lesson's `detailed` level. */
export function levelText(step: SiteStep, depth: Depth): readonly SiteBlock[] {
  switch (depth) {
    case 'simple':
      return step.levels.simple;
    case 'steps':
      return step.levels.detailed;
    case 'deep':
      return step.levels.deep;
  }
}

/** The tab an arrow key, Home or End moves to from `current`; null for any other key. */
export function tabAfterKey(current: Depth, key: string): Depth | null {
  const at = DEPTH_TABS.findIndex((t) => t.depth === current);
  const last = DEPTH_TABS.length - 1;
  let next: number;
  if (key === 'ArrowRight' || key === 'ArrowDown') next = at >= last ? 0 : at + 1;
  else if (key === 'ArrowLeft' || key === 'ArrowUp') next = at <= 0 ? last : at - 1;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = last;
  else return null;
  return DEPTH_TABS[next]?.depth ?? null;
}

// ---------------------------------------------------------------------------------------------
// Code at «Глубже»: the step's own code and, when there is one, its counterpart in the other mode

export interface CodeShown {
  /** «Без защиты», «С защитой», or '' for a step that plays in both modes. */
  readonly label: string;
  readonly code: SiteCode;
  /** The step on screen (the other one is its counterpart). */
  readonly current: boolean;
}

/**
 * The code to show at «Глубже» (K72): the step's code; for a step that plays in one mode only,
 * also the code of the first step of the other mode between the same two participants — the
 * query before and after the defence, one under the other. The step's own code comes first, so
 * it is in view without scrolling (K72, K73).
 */
export function codeAtDeep(steps: readonly SiteStep[], step: SiteStep): readonly CodeShown[] {
  if (step.mode === 'both')
    return step.code === null ? [] : [{ label: '', code: step.code, current: true }];
  const otherMode = step.mode === 'with-defence' ? 'without-defence' : 'with-defence';
  const other = steps.find(
    (s) => s.mode === otherMode && s.from === step.from && s.to === step.to && s.code !== null,
  );
  const mine: CodeShown | null =
    step.code === null ? null : { label: modeLabel(step.mode), code: step.code, current: true };
  if (mine === null) return [];
  if (other?.code == null) return [mine];
  const theirs: CodeShown = { label: modeLabel(other.mode), code: other.code, current: false };
  return [mine, theirs];
}

function modeLabel(mode: SiteStep['mode']): string {
  return mode === 'with-defence' ? 'С защитой' : 'Без защиты';
}

// ---------------------------------------------------------------------------------------------
// Passport

const SEVERITY_WORDS: Readonly<Record<Severity, string>> = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
  critical: 'критическая',
};

export function severityWord(severity: Severity): string {
  return SEVERITY_WORDS[severity];
}

/**
 * Russian names of the CWE entries the lessons use, for a passport without `class` (K71). Only
 * names checked against cwe.mitre.org; an unknown number gives no class line. The numbers and
 * official English names live in the checker's vetted list (src/core/lesson/ids.ts, K86); a test
 * keeps every number here in that list. Translations stay here: they are words of the interface.
 */
export const CWE_NAMES: Readonly<Record<number, string>> = {
  22: 'Обход пути к файлу',
  78: 'Внедрение команд ОС',
  79: 'Межсайтовый скриптинг (XSS)',
  89: 'SQL-инъекция',
  352: 'Подделка межсайтового запроса (CSRF)',
  918: 'Подделка запроса со стороны сервера (SSRF)',
};

export interface PassportRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** A second, smaller line: the CVSS vector under its score (M2.5). */
  readonly detail?: string;
}

const CVSS_SEVERITY_WORDS: Readonly<Record<CvssSeverity, string>> = {
  none: 'нет',
  ...SEVERITY_WORDS,
};

/**
 * The CVSS row (M2.5, K82): «9.8 · критическая» computed from the vector, the vector itself as
 * the detail line. A vector the calculator does not read (the checker rejects it, but site data is
 * hostile) is shown as it is, without a score.
 */
function cvssRow(vector: string): PassportRow {
  const r = scoreCvss31(vector);
  if (!r.ok) return { key: 'cvss', label: 'CVSS', value: vector };
  const { score, severity } = r.value;
  return {
    key: 'cvss',
    label: 'CVSS',
    value: `${formatScore(score)} · ${CVSS_SEVERITY_WORDS[severity]}`,
    detail: vector,
  };
}

/** The passport lines that have a value, in reading order. */
export function passportRows(passport: SitePassport): readonly PassportRow[] {
  const rows: PassportRow[] = [];
  const add = (key: string, label: string, value: string | null) => {
    if (value !== null && value.trim() !== '') rows.push({ key, label, value });
  };
  // An empty class is no class (the checker never gives one, but data is hostile).
  const own = passport.class !== null && passport.class.trim() !== '' ? passport.class : null;
  add('class', 'Класс', own ?? cweClass(passport.cwe));
  add('cwe', 'CWE', passport.cwe.map(cweLabel).join(', '));
  add('owasp', 'OWASP Top 10', passport.owasp.join(', '));
  add('attack', 'MITRE ATT&CK', passport.attack.join(', '));
  add('cves', 'CVE', passport.cves.join(', '));
  if (passport.cvss !== null && passport.cvss.trim() !== '') rows.push(cvssRow(passport.cvss));
  add('severity', 'Тяжесть', passport.severity === null ? null : severityWord(passport.severity));
  add('impact', 'Что получает атакующий', passport.impact);
  add('defence', 'Защита', passport.defence);
  return rows;
}

function cweName(n: number): string | undefined {
  return Object.hasOwn(CWE_NAMES, n) ? CWE_NAMES[n] : undefined;
}

/** «CWE-89 · SQL-инъекция», or «CWE-564» when the name is not known. */
function cweLabel(n: number): string {
  const name = cweName(n);
  const label = `CWE-${String(n)}`;
  return name === undefined ? label : `${label} · ${name}`;
}

function cweClass(cwe: readonly number[]): string | null {
  for (const n of cwe) {
    const name = cweName(n);
    if (name !== undefined) return name;
  }
  return null;
}
