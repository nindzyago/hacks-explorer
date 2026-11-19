/**
 * CVSS v3.1 vector strings and base scores (M2.5), exactly as the FIRST CVSS v3.1 specification
 * defines them: §6 (vector string), §7.1 (base equations), §7.4 (metric values), §5 (severity)
 * and Appendix A (Roundup with integer arithmetic). Pure: no throws, hostile input gives an error
 * value. Temporal and environmental metrics are read and checked (§6 says readers must accept
 * them) but not scored: the site shows base scores, as NVD does (K82).
 */

export const BASE_METRICS = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'] as const;
export type BaseMetric = (typeof BASE_METRICS)[number];

export interface CvssBase {
  readonly AV: 'N' | 'A' | 'L' | 'P';
  readonly AC: 'L' | 'H';
  readonly PR: 'N' | 'L' | 'H';
  readonly UI: 'N' | 'R';
  readonly S: 'U' | 'C';
  readonly C: 'H' | 'L' | 'N';
  readonly I: 'H' | 'L' | 'N';
  readonly A: 'H' | 'L' | 'N';
}

export interface CvssVector {
  readonly base: CvssBase;
  /** Temporal and environmental metrics as written (`E` → `F`), not scored. */
  readonly other: Readonly<Record<string, string>>;
}

export type CvssSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type CvssErrorCode =
  | 'not-a-string'
  | 'too-long'
  | 'bad-prefix'
  | 'bad-metric'
  | 'unknown-metric'
  | 'bad-value'
  | 'duplicate'
  | 'missing-base';

export interface CvssError {
  readonly code: CvssErrorCode;
  readonly message: string;
}

export type CvssParse =
  | { readonly ok: true; readonly vector: CvssVector }
  | { readonly ok: false; readonly error: CvssError };

export interface CvssScore {
  readonly vector: CvssVector;
  /** One decimal place, 0.0 to 10.0. */
  readonly score: number;
  readonly severity: CvssSeverity;
}

export type CvssResult =
  | { readonly ok: true; readonly value: CvssScore }
  | { readonly ok: false; readonly error: CvssError };

export const PREFIX = 'CVSS:3.1/';
/** Longer than any valid vector (all 22 metrics written out: 117 characters). */
export const MAX_LENGTH = 256;

// §6 Table 15: every metric and its allowed values.
const VALUES: ReadonlyMap<string, readonly string[]> = new Map([
  ['AV', ['N', 'A', 'L', 'P']],
  ['AC', ['L', 'H']],
  ['PR', ['N', 'L', 'H']],
  ['UI', ['N', 'R']],
  ['S', ['U', 'C']],
  ['C', ['H', 'L', 'N']],
  ['I', ['H', 'L', 'N']],
  ['A', ['H', 'L', 'N']],
  ['E', ['X', 'H', 'F', 'P', 'U']],
  ['RL', ['X', 'U', 'W', 'T', 'O']],
  ['RC', ['X', 'C', 'R', 'U']],
  ['CR', ['X', 'H', 'M', 'L']],
  ['IR', ['X', 'H', 'M', 'L']],
  ['AR', ['X', 'H', 'M', 'L']],
  ['MAV', ['X', 'N', 'A', 'L', 'P']],
  ['MAC', ['X', 'L', 'H']],
  ['MPR', ['X', 'N', 'L', 'H']],
  ['MUI', ['X', 'N', 'R']],
  ['MS', ['X', 'U', 'C']],
  ['MC', ['X', 'N', 'L', 'H']],
  ['MI', ['X', 'N', 'L', 'H']],
  ['MA', ['X', 'N', 'L', 'H']],
]);

function fail(code: CvssErrorCode, message: string): { ok: false; error: CvssError } {
  return { ok: false, error: { code, message } };
}

function show(text: string): string {
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

/** Reads a CVSS v3.1 vector string (§6): strict, case-sensitive, metrics in any order. */
export function parseCvss31(input: unknown): CvssParse {
  if (typeof input !== 'string') return fail('not-a-string', 'a CVSS vector is a string');
  if (input.length > MAX_LENGTH)
    return fail('too-long', `a CVSS vector is at most ${String(MAX_LENGTH)} characters`);
  if (!input.startsWith(PREFIX))
    return fail('bad-prefix', 'a CVSS v3.1 vector starts with CVSS:3.1/');
  const seen = new Map<string, string>();
  for (const part of input.slice(PREFIX.length).split('/')) {
    const m = /^([A-Z]{1,3}):([A-Z])$/.exec(part);
    if (m === null) return fail('bad-metric', `"${show(part)}" is not a metric like AV:N`);
    const [, name = '', value = ''] = m;
    const allowed = VALUES.get(name);
    if (allowed === undefined) return fail('unknown-metric', `unknown CVSS v3.1 metric ${name}`);
    if (!allowed.includes(value))
      return fail(
        'bad-value',
        `${name}:${value} is not allowed; ${name} is one of ${allowed.join(', ')}`,
      );
    if (seen.has(name)) return fail('duplicate', `${name} appears twice`);
    seen.set(name, value);
  }
  const missing = BASE_METRICS.filter((m) => !seen.has(m));
  if (missing.length > 0)
    return fail('missing-base', `base metrics missing: ${missing.join(', ')}`);
  const base = baseFrom(seen);
  if (base === null) return fail('missing-base', 'base metrics missing');
  const other: Record<string, string> = {};
  for (const [name, value] of seen)
    if (!(BASE_METRICS as readonly string[]).includes(name)) other[name] = value;
  return { ok: true, vector: { base, other: Object.freeze(other) } };
}

function baseFrom(seen: ReadonlyMap<string, string>): CvssBase | null {
  const AV = seen.get('AV');
  const AC = seen.get('AC');
  const PR = seen.get('PR');
  const UI = seen.get('UI');
  const S = seen.get('S');
  const C = seen.get('C');
  const I = seen.get('I');
  const A = seen.get('A');
  if (
    (AV === 'N' || AV === 'A' || AV === 'L' || AV === 'P') &&
    (AC === 'L' || AC === 'H') &&
    (PR === 'N' || PR === 'L' || PR === 'H') &&
    (UI === 'N' || UI === 'R') &&
    (S === 'U' || S === 'C') &&
    isCia(C) &&
    isCia(I) &&
    isCia(A)
  )
    return { AV, AC, PR, UI, S, C, I, A };
  return null;
}

function isCia(v: string | undefined): v is 'H' | 'L' | 'N' {
  return v === 'H' || v === 'L' || v === 'N';
}

/**
 * Appendix A: the smallest number with one decimal place that is ≥ `input`, computed on the
 * input scaled to 1e5 and rounded to an integer, so 0.1 + 0.2 gives 0.3, not 0.4.
 */
export function roundup(input: number): number {
  const intInput = Math.round(input * 100000);
  if (intInput % 10000 === 0) return intInput / 100000;
  return (Math.floor(intInput / 10000) + 1) / 10;
}

// §7.4 Table 16.
const AV_W = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as const;
const AC_W = { L: 0.77, H: 0.44 } as const;
const PR_W_UNCHANGED = { N: 0.85, L: 0.62, H: 0.27 } as const;
const PR_W_CHANGED = { N: 0.85, L: 0.68, H: 0.5 } as const;
const UI_W = { N: 0.85, R: 0.62 } as const;
const CIA_W = { H: 0.56, L: 0.22, N: 0 } as const;

/** §7.1 base score, one decimal place. */
export function baseScore(b: CvssBase): number {
  const iss = 1 - (1 - CIA_W[b.C]) * (1 - CIA_W[b.I]) * (1 - CIA_W[b.A]);
  const changed = b.S === 'C';
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const pr = changed ? PR_W_CHANGED[b.PR] : PR_W_UNCHANGED[b.PR];
  const exploitability = 8.22 * AV_W[b.AV] * AC_W[b.AC] * pr * UI_W[b.UI];
  if (impact <= 0) return 0;
  const sum = changed ? 1.08 * (impact + exploitability) : impact + exploitability;
  return roundup(Math.min(sum, 10));
}

/** §5 Table 14. A score outside 0–10 or not a number is treated as none. */
export function severityOf(score: number): CvssSeverity {
  if (!Number.isFinite(score) || score <= 0) return 'none';
  if (score < 4) return 'low';
  if (score < 7) return 'medium';
  if (score < 9) return 'high';
  return 'critical';
}

/** Parses `input` and scores its base metrics. */
export function scoreCvss31(input: unknown): CvssResult {
  const parsed = parseCvss31(input);
  if (!parsed.ok) return parsed;
  const score = baseScore(parsed.vector.base);
  return { ok: true, value: { vector: parsed.vector, score, severity: severityOf(score) } };
}

/** «9.8»: always one decimal place, a dot as in NVD and the specification (K82). */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
