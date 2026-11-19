import { describe, expect, it } from 'vitest';
import {
  BASE_METRICS,
  baseScore,
  type CvssBase,
  formatScore,
  MAX_LENGTH,
  parseCvss31,
  roundup,
  scoreCvss31,
  severityOf,
} from './cvss';
import firstExamples from './fixtures/first-examples.json';
import nvd from './fixtures/nvd.json';

function score(vector: string): number | string {
  const r = scoreCvss31(vector);
  return r.ok ? r.value.score : r.error.code;
}

describe('oracle R5: FIRST CVSS v3.1 worked examples', () => {
  it('pins at least 15 examples', () => {
    expect(firstExamples.examples.length).toBeGreaterThanOrEqual(15);
  });
  it.each(firstExamples.examples)(
    'example $n $cve: $vector → $score',
    ({ vector, score: want }) => {
      expect(score(vector)).toBe(want);
    },
  );
  it('scores the §6 example vectors, the reordered one too', () => {
    expect(score('CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:L/I:L/A:N')).toBe(3.8);
    expect(score('CVSS:3.1/S:U/AV:N/AC:L/PR:H/UI:N/C:L/I:L/A:N/E:F/RL:X')).toBe(3.8);
  });
});

describe('oracle R6: NVD CVSS v3.1 for catalog CVEs', () => {
  it('has seven CVEs, six named in the catalog', () => {
    expect(nvd.cves.length).toBeGreaterThanOrEqual(7);
    expect(nvd.cves.filter((c) => c.catalog).length).toBe(6);
  });
  it.each(nvd.cves)('$cve: $vector → $score $severity', ({ vector, score: want, severity }) => {
    const r = scoreCvss31(vector);
    expect(r.ok && r.value.score).toBe(want);
    expect(r.ok && r.value.severity.toUpperCase()).toBe(severity);
  });
});

// ---------------------------------------------------------------------------------------------
// An independent exact implementation (rational numbers on BigInt) of §7.1 and Roundup as §7
// defines it: «the smallest number, specified to 1 decimal place, that is equal to or higher than
// its input». Every one of the 2592 base vectors must agree with the float implementation.

interface Q {
  readonly n: bigint;
  readonly d: bigint;
}
const q = (n: number | bigint, d: number | bigint = 1): Q => ({ n: BigInt(n), d: BigInt(d) });
const add = (a: Q, b: Q): Q => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const sub = (a: Q, b: Q): Q => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const mul = (a: Q, b: Q): Q => ({ n: a.n * b.n, d: a.d * b.d });
const lt = (a: Q, b: Q): boolean => a.n * b.d < b.n * a.d;
const pow = (a: Q, k: number): Q => {
  let r = q(1);
  for (let i = 0; i < k; i++) r = mul(r, a);
  return r;
};
/** Ceil to tenths, as an integer number of tenths. */
const ceilTenths = (a: Q): bigint => {
  const n = a.n * 10n;
  const f = n / a.d;
  return f * a.d === n || n < 0n ? f : f + 1n;
};

const W = {
  AV: { N: q(85, 100), A: q(62, 100), L: q(55, 100), P: q(20, 100) },
  AC: { L: q(77, 100), H: q(44, 100) },
  PRU: { N: q(85, 100), L: q(62, 100), H: q(27, 100) },
  PRC: { N: q(85, 100), L: q(68, 100), H: q(50, 100) },
  UI: { N: q(85, 100), R: q(62, 100) },
  CIA: { H: q(56, 100), L: q(22, 100), N: q(0) },
};

function exactTenths(b: CvssBase): bigint {
  const one = q(1);
  const iss = sub(one, mul(mul(sub(one, W.CIA[b.C]), sub(one, W.CIA[b.I])), sub(one, W.CIA[b.A])));
  const changed = b.S === 'C';
  const impact = changed
    ? sub(mul(q(752, 100), sub(iss, q(29, 1000))), mul(q(325, 100), pow(sub(iss, q(2, 100)), 15)))
    : mul(q(642, 100), iss);
  if (!lt(q(0), impact)) return 0n;
  const pr = changed ? W.PRC[b.PR] : W.PRU[b.PR];
  const expl = mul(mul(mul(mul(q(822, 100), W.AV[b.AV]), W.AC[b.AC]), pr), W.UI[b.UI]);
  let sum = add(impact, expl);
  if (changed) sum = mul(q(108, 100), sum);
  if (lt(q(10), sum)) sum = q(10);
  return ceilTenths(sum);
}

function* allBases(): Generator<CvssBase> {
  for (const AV of ['N', 'A', 'L', 'P'] as const)
    for (const AC of ['L', 'H'] as const)
      for (const PR of ['N', 'L', 'H'] as const)
        for (const UI of ['N', 'R'] as const)
          for (const S of ['U', 'C'] as const)
            for (const C of ['H', 'L', 'N'] as const)
              for (const I of ['H', 'L', 'N'] as const)
                for (const A of ['H', 'L', 'N'] as const) yield { AV, AC, PR, UI, S, C, I, A };
}

const vectorOf = (b: CvssBase): string =>
  `CVSS:3.1/${BASE_METRICS.map((m) => `${m}:${b[m]}`).join('/')}`;

/** Naive v3.0-style rounding, the trap Appendix A warns about. */
function naiveScore(b: CvssBase): number {
  const c = { H: 0.56, L: 0.22, N: 0 };
  const iss = 1 - (1 - c[b.C]) * (1 - c[b.I]) * (1 - c[b.A]);
  const changed = b.S === 'C';
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const pr = changed ? { N: 0.85, L: 0.68, H: 0.5 }[b.PR] : { N: 0.85, L: 0.62, H: 0.27 }[b.PR];
  const e =
    8.22 *
    { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[b.AV] *
    { L: 0.77, H: 0.44 }[b.AC] *
    pr *
    { N: 0.85, R: 0.62 }[b.UI];
  if (impact <= 0) return 0;
  const sum = changed ? 1.08 * (impact + e) : impact + e;
  return Math.ceil(Math.min(sum, 10) * 10) / 10;
}

describe('base score equals exact rational arithmetic', () => {
  const bases = [...allBases()];
  it('covers all 2592 base vectors', () => {
    expect(bases.length).toBe(2592);
  });
  it('agrees on every base vector', () => {
    const differ = bases.filter((b) => BigInt(Math.round(baseScore(b) * 10)) !== exactTenths(b));
    expect(differ.map(vectorOf)).toEqual([]);
  });
  it('returns numbers with one decimal place that print as themselves', () => {
    for (const b of bases) {
      const s = baseScore(b);
      expect(Number(formatScore(s))).toBe(s);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    }
  });
  it('matches exact arithmetic wherever naive ceil rounding would differ', () => {
    // Measured: with this evaluation order naive ceil happens to agree on all base vectors; the
    // trap Appendix A describes shows up in the Roundup tests below (0.1 + 0.2, 1 − 0.58).
    const traps = bases.filter((b) => naiveScore(b) !== baseScore(b));
    for (const b of traps) expect(BigInt(Math.round(baseScore(b) * 10))).toBe(exactTenths(b));
  });
});

describe('roundup (Appendix A)', () => {
  it.each([
    [4.02, 4.1],
    [4.0, 4.0],
    [0.1 + 0.2, 0.3],
    [1.200003, 1.2],
    [1.200009, 1.3],
    [0, 0],
    [9.99, 10],
    [10, 10],
  ])('%s → %s', (input, want) => {
    expect(roundup(input)).toBe(want);
  });
  it('avoids the float traps where naive ceil is wrong', () => {
    expect(Math.ceil((0.1 + 0.2) * 10) / 10).toBe(0.4);
    expect(roundup(0.1 + 0.2)).toBe(0.3);
    expect(Math.ceil((1 - 0.58) * 100) / 100).toBe(0.43);
    expect(roundup((1 - 0.58) * 10)).toBe(4.2);
  });
});

describe('severity (§5)', () => {
  it.each([
    [0, 'none'],
    [0.1, 'low'],
    [3.9, 'low'],
    [4.0, 'medium'],
    [6.9, 'medium'],
    [7.0, 'high'],
    [8.9, 'high'],
    [9.0, 'critical'],
    [10, 'critical'],
    [Number.NaN, 'none'],
    [-1, 'none'],
  ])('%s → %s', (s, want) => {
    expect(severityOf(s)).toBe(want);
  });
  it('gives none for no impact', () => {
    const r = scoreCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:N/A:N');
    expect(r.ok && [r.value.score, r.value.severity]).toEqual([0, 'none']);
  });
});

describe('parser (§6)', () => {
  const ok = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';

  it('keeps temporal and environmental metrics without scoring them', () => {
    const r = parseCvss31(`${ok}/E:F/RL:O/RC:C/CR:H/MAV:L/MS:C`);
    expect(r.ok && r.vector.other).toEqual({
      E: 'F',
      RL: 'O',
      RC: 'C',
      CR: 'H',
      MAV: 'L',
      MS: 'C',
    });
    expect(score(`${ok}/E:U/RL:O/RC:U`)).toBe(9.8);
  });

  it.each([
    [42, 'not-a-string'],
    [null, 'not-a-string'],
    [undefined, 'not-a-string'],
    [{}, 'not-a-string'],
    ['', 'bad-prefix'],
    ['CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-prefix'],
    ['CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N', 'bad-prefix'],
    ['cvss:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-prefix'],
    [' CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-prefix'],
    ['AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-prefix'],
    ['CVSS:3.1/', 'bad-metric'],
    ['CVSS:3.1', 'bad-prefix'],
    [`${ok}/`, 'bad-metric'],
    [`${ok} `, 'bad-metric'],
    [`${ok}//E:F`, 'bad-metric'],
    ['CVSS:3.1/AV:n/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-metric'],
    ['CVSS:3.1/AV:NN/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-metric'],
    ['CVSS:3.1/AV:Х/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-metric'],
    [`${ok}/XX:Y`, 'unknown-metric'],
    [`${ok}/AT:N`, 'unknown-metric'],
    ['CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-value'],
    ['CVSS:3.1/AV:N/AC:M/PR:N/UI:N/S:U/C:H/I:H/A:H', 'bad-value'],
    [`${ok}/E:Z`, 'bad-value'],
    [`${ok}/AV:N`, 'duplicate'],
    [`${ok}/E:F/E:F`, 'duplicate'],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H', 'missing-base'],
    ['CVSS:3.1/E:F', 'missing-base'],
    [`${ok}${'/E:F'.repeat(100)}`, 'too-long'],
  ])('%j → %s', (input, code) => {
    const r = scoreCvss31(input);
    expect(r.ok ? 'ok' : r.error.code).toBe(code);
  });

  it('never throws and answers fast on huge input', () => {
    const huge = `CVSS:3.1/${'AV:N/'.repeat(200000)}`;
    expect(huge.length).toBeGreaterThan(MAX_LENGTH);
    const r = scoreCvss31(huge);
    expect(r.ok ? 'ok' : r.error.code).toBe('too-long');
    for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const r2 = scoreCvss31(`${ok}/${name}:X`);
      expect(r2.ok).toBe(false);
    }
  });

  it('accepts every valid vector at the length limit', () => {
    const full =
      'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/E:X/RL:X/RC:X/CR:X/IR:X/AR:X/MAV:X/MAC:X/MPR:X/MUI:X/MS:X/MC:X/MI:X/MA:X';
    expect(full.length).toBeLessThanOrEqual(MAX_LENGTH);
    expect(score(full)).toBe(9.8);
  });
});
