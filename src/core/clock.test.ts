// Acceptance for M0.4 (unit half): the same scenario run twice gives an identical state dump.
// Oracle: level A, two runs compared byte for byte; behaviour of the clock itself is level D
// (plan row M0.4, architecture §4), exact asserts.
import { describe, expect, it } from 'vitest';
import { ClockConfigError, MAX_TIME_MS, createClock, type ClockEvent } from './clock';
import { stableDump } from './dump';

type Call = readonly ['set' | 'tick', unknown];

interface Toy {
  position: number;
  velocity: number;
  bounces: number;
  seeks: number[];
  trail: string[];
  seenByListener: string[];
}

/** A toy "player": subscribers that change one state, driven by the clock only. */
function runScenario(calls: readonly Call[]): {
  dump: string;
  events: string[];
  results: string[];
} {
  const clock = createClock();
  const state: Toy = {
    position: 0,
    velocity: 3,
    bounces: 0,
    seeks: [],
    trail: [],
    seenByListener: [],
  };
  const events: string[] = [];
  clock.subscribe((event) => {
    if (event.type !== 'step') return;
    state.position += state.velocity;
    if (state.position > 50 || state.position < 0) {
      state.velocity = -state.velocity;
      state.bounces += 1;
    }
  });
  clock.subscribe((event) => {
    if (event.type === 'set') state.seeks.push(event.timeMs);
    else if (event.timeMs % 50 === 0) {
      state.trail.push(`${String(event.timeMs)}:${String(state.position)}`);
      // What a subscriber can read from the clock inside a step must not depend on slicing.
      state.seenByListener.push(`${String(clock.now())}/${JSON.stringify(clock.snapshot())}`);
    }
  });
  clock.subscribe((event) => events.push(`${event.type}@${String(event.timeMs)}`));
  const results = calls.map(([kind, ms]) => {
    const result = kind === 'set' ? clock.set(ms) : clock.tick(ms);
    return result.ok ? `ok:${String(result.steps)}` : result.error.code;
  });
  const dumped = stableDump({ state, clock: clock.snapshot() });
  if (!dumped.ok) throw new Error(dumped.error.message);
  return { dump: dumped.text, events, results };
}

const SCRIPT: readonly Call[] = [
  ['tick', 16],
  ['tick', 17],
  ['tick', 250],
  ['set', 1234],
  ['tick', 7],
  ['tick', Number.NaN],
  ['tick', 999],
  ['set', 0],
  ['tick', 3333],
  ['set', -5],
  ['tick', '40'],
];

describe('determinism: acceptance (M0.4)', () => {
  it('the same scenario run twice gives an identical state dump', () => {
    const first = runScenario(SCRIPT);
    const second = runScenario(SCRIPT);
    expect(second.dump).toBe(first.dump);
    expect(second.events).toEqual(first.events);
    expect(second.results).toEqual(first.results);
    // The scenario really did something, and hostile calls were rejected without effect.
    expect(first.events).toHaveLength(464);
    expect(first.results).toEqual([
      'ok:1',
      'ok:2',
      'ok:25',
      'ok:0',
      'ok:1',
      'invalid-time',
      'ok:100',
      'ok:0',
      'ok:333',
      'invalid-time',
      'invalid-time',
    ]);
    expect(first.dump).toContain('"timeMs": 3330');
    expect(first.dump).toContain('"pendingMs": 3');
    expect(first.dump).toContain('"bounces": ');
  });

  it('a tick gives the same steps however it is sliced', () => {
    const whole = runScenario([['tick', 100]]);
    const twoParts = runScenario([
      ['tick', 40],
      ['tick', 60],
    ]);
    const byOne = runScenario(Array.from({ length: 100 }, (): Call => ['tick', 1]));
    expect(whole.events).toHaveLength(10);
    expect(twoParts.events).toEqual(whole.events);
    expect(twoParts.dump).toBe(whole.dump);
    expect(byOne.events).toEqual(whole.events);
    expect(byOne.dump).toBe(whole.dump);
  });

  it('slicing invariance holds for many uneven slicings', () => {
    const total = 5000;
    const whole = runScenario([['tick', total]]);
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let round = 0; round < 20; round += 1) {
      const calls: Call[] = [];
      let left = total;
      while (left > 0) {
        const part = Math.min(left, next() % 97);
        calls.push(['tick', part]);
        left -= part;
      }
      const sliced = runScenario(calls);
      expect(sliced.events).toEqual(whole.events);
      expect(sliced.dump).toBe(whole.dump);
    }
  });
});

describe('clock', () => {
  it('starts at zero and advances in whole steps, keeping the remainder', () => {
    const clock = createClock();
    expect(clock.stepMs).toBe(10);
    expect(clock.now()).toBe(0);
    expect(clock.tick(9)).toEqual({ ok: true, steps: 0 });
    expect(clock.now()).toBe(0);
    expect(clock.snapshot()).toEqual({ timeMs: 0, pendingMs: 9, stepMs: 10 });
    expect(clock.tick(1)).toEqual({ ok: true, steps: 1 });
    expect(clock.now()).toBe(10);
    expect(clock.tick(0)).toEqual({ ok: true, steps: 0 });
  });

  it('takes the step from options', () => {
    const clock = createClock({ stepMs: 4, maxStepsPerTick: 5 });
    expect(clock.maxTickMs).toBe(20);
    expect(clock.tick(20)).toEqual({ ok: true, steps: 5 });
    expect(clock.tick(21)).toMatchObject({ ok: false, error: { code: 'tick-too-large' } });
    expect(clock.now()).toBe(20);
  });

  it('rejects bad options with a typed error', () => {
    for (const options of [
      { stepMs: 0 },
      { stepMs: -1 },
      { stepMs: 1.5 },
      { stepMs: Number.NaN },
      { stepMs: MAX_TIME_MS + 1 },
      { maxStepsPerTick: 0 },
      { maxStepsPerTick: Number.POSITIVE_INFINITY },
      { maxStepsPerTick: 1_000_001 },
    ]) {
      expect(() => createClock(options)).toThrow(ClockConfigError);
    }
  });

  it('set jumps without steps, tells subscribers once and keeps the part of a step', () => {
    const clock = createClock();
    const seen: ClockEvent[] = [];
    clock.subscribe((event) => seen.push(event));
    expect(clock.set(1234)).toEqual({ ok: true, steps: 0 });
    expect(seen).toEqual([{ type: 'set', timeMs: 1230 }]);
    expect(clock.snapshot()).toEqual({ timeMs: 1230, pendingMs: 4, stepMs: 10 });
    expect(clock.tick(6)).toEqual({ ok: true, steps: 1 });
    expect(seen[1]).toEqual({ type: 'step', timeMs: 1240, stepMs: 10 });
    expect(clock.set(0)).toEqual({ ok: true, steps: 0 });
    expect(clock.snapshot()).toEqual({ timeMs: 0, pendingMs: 0, stepMs: 10 });
  });

  it('calls subscribers in subscription order on every step', () => {
    const clock = createClock();
    const order: string[] = [];
    clock.subscribe(() => order.push('a'));
    clock.subscribe(() => order.push('b'));
    clock.subscribe(() => order.push('c'));
    clock.tick(20);
    expect(order.join('')).toBe('abcabc');
  });

  it('a subscriber cannot change the event for the next subscriber', () => {
    const clock = createClock();
    const seen: number[] = [];
    clock.subscribe((event) => {
      try {
        (event as { timeMs: number }).timeMs = 999;
      } catch {
        // frozen
      }
    });
    clock.subscribe((event) => seen.push(event.timeMs));
    clock.tick(10);
    expect(seen).toEqual([10]);
  });

  it('unsubscribe is immediate and repeatable; a subscriber added in a step waits for the next', () => {
    const clock = createClock();
    const order: string[] = [];
    const late = () => order.push('late');
    let added = false;
    const offB: (() => void)[] = [];
    clock.subscribe(() => {
      order.push('a');
      offB[0]?.();
      if (!added) {
        added = true;
        clock.subscribe(late);
      }
    });
    offB.push(clock.subscribe(() => order.push('b')));
    clock.tick(20);
    expect(order).toEqual(['a', 'a', 'late']);
    offB[0]?.();
    offB[0]?.();
    clock.tick(10);
    expect(order).toEqual(['a', 'a', 'late', 'a', 'late']);
  });

  it('a subscriber added during an event is first called on the next event', () => {
    const clock = createClock();
    const order: string[] = [];
    let added = false;
    clock.subscribe((event) => {
      order.push(`first@${String(event.timeMs)}`);
      if (added) return;
      added = true;
      clock.subscribe((later) => order.push(`added@${String(later.timeMs)}`));
    });
    clock.subscribe((event) => order.push(`second@${String(event.timeMs)}`));
    clock.tick(20);
    expect(order).toEqual(['first@10', 'second@10', 'first@20', 'second@20', 'added@20']);
  });

  it('both kinds of event are frozen', () => {
    const clock = createClock();
    const frozen: string[] = [];
    clock.subscribe((event) => frozen.push(`${event.type}:${String(Object.isFrozen(event))}`));
    clock.set(50);
    clock.tick(10);
    expect(frozen).toEqual(['set:true', 'step:true']);
  });

  it('the same function subscribed twice is two subscriptions', () => {
    const clock = createClock();
    let calls = 0;
    const listener = () => {
      calls += 1;
    };
    const off = clock.subscribe(listener);
    clock.subscribe(listener);
    clock.tick(10);
    expect(calls).toBe(2);
    off();
    clock.tick(10);
    expect(calls).toBe(3);
  });

  it('rejects hostile time values without changing anything', () => {
    const clock = createClock();
    const seen: ClockEvent[] = [];
    clock.subscribe((event) => seen.push(event));
    clock.tick(15);
    const before = clock.snapshot();
    seen.length = 0;
    const hostile: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      -0.5,
      0.5,
      1e300,
      Number.MAX_SAFE_INTEGER + 2,
      '10',
      null,
      undefined,
      true,
      {},
      [10],
      10n,
      { valueOf: () => 10 },
      Symbol('t'),
    ];
    for (const value of hostile) {
      expect(clock.tick(value)).toMatchObject({ ok: false, error: { code: 'invalid-time' } });
      expect(clock.set(value)).toMatchObject({ ok: false, error: { code: 'invalid-time' } });
    }
    expect(clock.snapshot()).toEqual(before);
    expect(seen).toEqual([]);
  });

  it('caps the steps of one tick and the total time', () => {
    const clock = createClock();
    expect(clock.maxTickMs).toBe(10_000);
    expect(clock.tick(10_001)).toMatchObject({ ok: false, error: { code: 'tick-too-large' } });
    expect(clock.tick(Number.MAX_SAFE_INTEGER)).toMatchObject({
      ok: false,
      error: { code: 'tick-too-large' },
    });
    expect(clock.now()).toBe(0);
    expect(clock.tick(10_000)).toEqual({ ok: true, steps: 1000 });

    expect(clock.set(MAX_TIME_MS + 1)).toMatchObject({
      ok: false,
      error: { code: 'out-of-range' },
    });
    expect(clock.set(MAX_TIME_MS - 5)).toEqual({ ok: true, steps: 0 });
    expect(clock.tick(6)).toMatchObject({ ok: false, error: { code: 'out-of-range' } });
    expect(clock.tick(5)).toEqual({ ok: true, steps: 1 });
    expect(clock.now()).toBe(MAX_TIME_MS);
  });

  it('a subscriber cannot move the clock from inside a step', () => {
    const clock = createClock();
    const inner: unknown[] = [];
    clock.subscribe(() => {
      inner.push(clock.tick(10), clock.set(500));
    });
    expect(clock.tick(10)).toEqual({ ok: true, steps: 1 });
    expect(inner).toMatchObject([
      { ok: false, error: { code: 'reentrant' } },
      { ok: false, error: { code: 'reentrant' } },
    ]);
    expect(clock.now()).toBe(10);
  });

  it('a throwing subscriber does not stop time or the other subscribers', () => {
    const clock = createClock();
    let calls = 0;
    clock.subscribe(() => {
      throw new Error('boom');
    });
    clock.subscribe(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- hostile on purpose
      throw {
        toString() {
          throw new Error('unprintable');
        },
      };
    });
    clock.subscribe(() => {
      calls += 1;
    });
    const result = clock.tick(30);
    expect(result).toMatchObject({ ok: false, error: { code: 'listener-failed' } });
    expect(calls).toBe(3);
    expect(clock.now()).toBe(30);
    // The clock is usable afterwards.
    expect(clock.set(0)).toMatchObject({ ok: false, error: { code: 'listener-failed' } });
    expect(clock.now()).toBe(0);
    expect(calls).toBe(4);
  });

  it('results and snapshots are plain data', () => {
    const clock = createClock();
    for (const value of [clock.tick(25), clock.tick(-1), clock.snapshot()]) {
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    }
  });
});
