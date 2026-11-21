// CI7: the parts of the browser tests. Every test runs in exactly one part, the lessons are dealt
// evenly, a bad E2E_SHARD stops the run.
import { describe, expect, it } from 'vitest';
import { parseShard, shardFilter } from './e2e-shards.mjs';

/** Whether Playwright runs a test with this title under the filter (its grep rules). */
const runs = (filter, title) =>
  (filter.grep === undefined || filter.grep.test(title)) &&
  !(filter.grepInvert !== undefined && filter.grepInvert.test(title));

const IDS = ['A1', 'A2', 'B1', 'B10', 'C3', 'D1', 'I1', 'K1', 'L5'];

/** The parts (1-based) that run `title`. */
const partsOf = (title, total, ids = IDS) =>
  Array.from({ length: total }, (_, i) => i + 1).filter((current) =>
    runs(shardFilter(ids, { current, total }), title),
  );

describe('shardFilter', () => {
  const titles = [
    'e2e/a11y.spec.ts axe finds no WCAG A/AA violations ru B1 with defence: first, middle, last step',
    'e2e/scene.spec.ts at 360×800 B10, ru and en: the message at rest covers nothing',
    'e2e/phone.spec.ts step 3 screenshots at 390×844 B1 and I1, both modes',
    'e2e/layout.spec.ts screenshots at 1440 en: B1, K1 and the about page',
    'e2e/player.spec.ts the site clock runs while the player plays',
    'e2e/address.spec.ts the address /ru/lesson/L5#step-2 opens step 2',
    'e2e/one-screen.spec.ts one screen at 1024×768 en L5: every step of both modes fits',
    // Not lesson ids: S1, M2.6, K136, a11y, phone-375, CWE-89.
    'e2e/scenarios.spec.ts S1 M2.6 K136 a11y phone-375 CWE-89',
  ];

  it.each([2, 3, 4, 5, 6, 9, 12])('runs every test in exactly one of %i parts', (total) => {
    for (const title of titles) expect(partsOf(title, total), title).toHaveLength(1);
  });

  it('runs a test in the part of the first-dealt lesson it names; no lesson → part 1', () => {
    // Dealt in turn over 3 parts: A1 1, A2 2, B1 3, B10 1, C3 2, D1 3, I1 1, K1 2, L5 3.
    expect(partsOf('B1 and I1, both modes', 3)).toEqual([1]);
    expect(partsOf('C3 and K1', 3)).toEqual([2]);
    expect(partsOf('B1: the scene', 3)).toEqual([3]);
    expect(partsOf('B10: the scene', 3)).toEqual([1]);
    expect(partsOf('the home page', 3)).toEqual([1]);
    expect(partsOf('S10 at 360 K136', 3)).toEqual([1]);
  });

  it('deals the lessons evenly', () => {
    const ids = Array.from(
      { length: 75 },
      (_, i) => `${'ABCDEFGHIJKL'[i % 12] ?? 'A'}${String(1 + Math.floor(i / 12))}`,
    );
    for (const total of [4, 5, 6]) {
      const counts = Array.from(
        { length: total },
        (_, i) =>
          ids.filter((id) => partsOf(`${id}: a lesson test`, total, ids)[0] === i + 1).length,
      );
      expect(Math.max(...counts) - Math.min(...counts), String(total)).toBeLessThanOrEqual(1);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(75);
    }
  });

  it('ignores names that are not lesson ids and works with more parts than lessons', () => {
    expect(partsOf('B1: x', 4, ['B1', '../x', 'b2', 'B1|.*'])).toEqual([1]);
    expect(partsOf('the home page', 4, [])).toEqual([1]);
    expect(partsOf('B1: x', 4, ['B1'])).toEqual([1]);
  });
});

describe('parseShard', () => {
  it('reads k/n', () => {
    expect(parseShard(undefined)).toBeNull();
    expect(parseShard('')).toBeNull();
    expect(parseShard('1/5')).toEqual({ current: 1, total: 5 });
    expect(parseShard('12/12')).toEqual({ current: 12, total: 12 });
  });

  it.each(['0/5', '6/5', '1/0', '1', '1/5/2', ' 1/5', 'a/b', '1/100', '-1/5'])(
    'refuses %j',
    (value) => {
      expect(() => parseShard(value)).toThrow(/E2E_SHARD/);
    },
  );
});
