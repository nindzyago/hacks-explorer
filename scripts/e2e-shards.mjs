// CI7: the browser tests in parts. The gate job of both workflows (`gate.yml`, `release.yml`)
// runs `npm run gate` as n parallel jobs, each with E2E_SHARD=k/n; `playwright.config.ts` turns
// that into the part's filter with shardFilter().
//
// A part is a set of lessons, not a run of test files: almost all the time goes to tests of one
// lesson, so Playwright's own sharding (consecutive tests in file order) gave parts from 1535 to
// 3288 s on 75 lessons, while lessons dealt in turn (A1 → 1, A2 → 2, …) give 2238–2653 s. A test
// runs in the part of the first-dealt lesson its title names; a test that names no lesson runs in
// part 1. So every test runs in exactly one part, whatever its title says.
//
// checkGateShards() is the guard `deploy-config.test.mjs` and `release.test.mjs` run on the gate
// job: every part from 1 to n runs, and each job is told the same n, so no test is left out.

/** A lesson id as it stands in a test title: B1, K12. */
const ID = /^[A-L]\d{1,2}$/;

/**
 * E2E_SHARD as { current, total }; null when it is not set. Throws on anything else.
 * @param {string | undefined} value
 * @returns {{ current: number; total: number } | null}
 */
export function parseShard(value) {
  if (value === undefined || value === '') return null;
  const m = /^([1-9]\d?)\/([1-9]\d?)$/.exec(value);
  const current = Number(m?.[1]);
  const total = Number(m?.[2]);
  if (m === null || current > total) {
    throw new Error('E2E_SHARD must be k/n with 1 ≤ k ≤ n ≤ 99');
  }
  return { current, total };
}

/**
 * The Playwright `grep` / `grepInvert` of part `current` of `total` over the lessons `ids`
 * (dealt in the given order). Ids that are not lesson ids are ignored.
 * @param {readonly string[]} ids
 * @param {{ current: number; total: number }} shard
 * @returns {{ grep?: RegExp; grepInvert?: RegExp }}
 */
export function shardFilter(ids, shard) {
  const { current, total } = shard;
  /** @type {string[][]} */
  const parts = Array.from({ length: total }, () => []);
  ids.filter((id) => ID.test(id)).forEach((id, i) => parts[i % total]?.push(id));
  const any = (list) => new RegExp(`\\b(?:${list.length === 0 ? '(?!)' : list.join('|')})\\b`);
  const own = parts[current - 1] ?? [];
  const before = parts.slice(0, current - 1).flat();
  if (current === 1) {
    // Part 1: everything except a test that names a later part's lesson and none of its own.
    const later = parts.slice(1).flat();
    return {
      grepInvert: new RegExp(`^(?!.*${any(own).source}).*${any(later).source}`),
    };
  }
  return { grep: any(own), grepInvert: any(before) };
}

/**
 * Problems of the sharded gate job; [] when it is right. Never throws.
 * @param {unknown} job the text of the job (its lines under `  gate:`), comments removed
 * @returns {string[]}
 */
export function checkGateShards(job) {
  const text = typeof job === 'string' ? job : '';
  const problems = [];
  const list = /^ {6}matrix:\s*\n {8}shard:\s*\[([^\]\n]*)\]\s*$/m.exec(text)?.[1];
  const shards = (list ?? '').split(',').map((s) => s.trim());
  const total = shards.length;
  if (list === undefined || !shards.every((s, i) => s === String(i + 1)) || total < 2) {
    problems.push('the gate must run the browser tests in parts: matrix shard: [1, 2, …, n]');
  }
  const env = /^ {10}E2E_SHARD:\s*(.*?)\s*$/m.exec(text)?.[1];
  if (env !== `\${{ matrix.shard }}/${String(total)}`) {
    problems.push(
      `each part must be told its number and the count: E2E_SHARD: \${{ matrix.shard }}/${String(total)}`,
    );
  }
  if (!/^ {4}strategy:\s*$/m.test(text)) problems.push('the matrix must be the job strategy');
  if (!/^ {8}run: npm run gate\s*$/m.test(text)) problems.push('each part must run npm run gate');
  return problems;
}
