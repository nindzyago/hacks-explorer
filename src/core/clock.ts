/**
 * Player clock: the only source of time for animation (AGENTS.md, "Время подменяемо").
 *
 * Pure: it never reads system time. Someone feeds it milliseconds — the real-time driver on the
 * running site, a test or the control channel by hand — and it turns them into whole steps of a
 * fixed size. The steps of `tick(100)` and of `tick(40)` + `tick(60)` are the same.
 * Behaviour and limits are described in README.md.
 */

export const DEFAULT_STEP_MS = 10;
export const DEFAULT_MAX_STEPS_PER_TICK = 1000;
/** The clock stops accepting time after 24 hours: no lesson is that long, and sums stay exact. */
export const MAX_TIME_MS = 86_400_000;
const MAX_STEPS_LIMIT = 1_000_000;

export type ClockEvent =
  | { readonly type: 'step'; readonly timeMs: number; readonly stepMs: number }
  | { readonly type: 'set'; readonly timeMs: number };

export type ClockListener = (event: ClockEvent) => void;

export type ClockErrorCode =
  'invalid-time' | 'tick-too-large' | 'out-of-range' | 'reentrant' | 'listener-failed';

/** Plain data. */
export interface ClockError {
  readonly code: ClockErrorCode;
  readonly message: string;
}

export type ClockResult =
  | { readonly ok: true; readonly steps: number }
  | { readonly ok: false; readonly error: ClockError };

/** Plain data: everything that defines the clock's future behaviour. */
export interface ClockSnapshot {
  /** Time of the last completed step; always a multiple of `stepMs`. */
  readonly timeMs: number;
  /** Milliseconds received after the last step, always less than `stepMs`. */
  readonly pendingMs: number;
  readonly stepMs: number;
}

export interface ClockOptions {
  readonly stepMs?: number | undefined;
  readonly maxStepsPerTick?: number | undefined;
}

export interface Clock {
  readonly stepMs: number;
  /** The largest value one `tick` accepts: `stepMs * maxStepsPerTick`. */
  readonly maxTickMs: number;
  /** Time of the last completed step, in milliseconds. */
  now(): number;
  snapshot(): ClockSnapshot;
  /** Jumps to `ms` without steps; subscribers get one `set` event. Never throws. */
  set(ms: unknown): ClockResult;
  /** Adds `ms` and runs every whole step that fits. Never throws. */
  tick(ms: unknown): ClockResult;
  /** Subscribers are called in subscription order. Returns the function that unsubscribes. */
  subscribe(listener: ClockListener): () => void;
}

/** Thrown by `createClock`: a mistake in the code that sets the clock up. */
export class ClockConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClockConfigError';
  }
}

interface Subscription {
  readonly listener: ClockListener;
  active: boolean;
}

function fail(code: ClockErrorCode, message: string): ClockResult {
  return { ok: false, error: { code, message } };
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const INVALID_TIME = 'time must be a whole number of milliseconds, zero or more';

/** @throws {ClockConfigError} when an option is not a positive whole number within limits. */
export function createClock(options: ClockOptions = {}): Clock {
  const stepMs = options.stepMs ?? DEFAULT_STEP_MS;
  const maxSteps = options.maxStepsPerTick ?? DEFAULT_MAX_STEPS_PER_TICK;
  if (!Number.isSafeInteger(stepMs) || stepMs < 1 || stepMs > MAX_TIME_MS) {
    throw new ClockConfigError(`stepMs must be a whole number from 1 to ${String(MAX_TIME_MS)}`);
  }
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEPS_LIMIT) {
    throw new ClockConfigError(
      `maxStepsPerTick must be a whole number from 1 to ${String(MAX_STEPS_LIMIT)}`,
    );
  }
  const maxTickMs = stepMs * maxSteps;

  let timeMs = 0;
  let pendingMs = 0;
  let dispatching = false;
  let subscriptions: Subscription[] = [];

  /** Returns how many subscriber calls threw. */
  function emit(event: ClockEvent): number {
    let failures = 0;
    // A subscriber added during this event is not in `current`; a removed one is skipped.
    const current = subscriptions;
    for (const subscription of current) {
      if (!subscription.active) continue;
      try {
        subscription.listener(event);
      } catch {
        failures += 1;
      }
    }
    return failures;
  }

  function finish(steps: number, failures: number): ClockResult {
    if (failures === 0) return { ok: true, steps };
    return fail(
      'listener-failed',
      `time moved to ${String(timeMs)} ms, but ${String(failures)} subscriber call(s) threw`,
    );
  }

  function set(ms: unknown): ClockResult {
    if (dispatching) return fail('reentrant', 'a subscriber cannot move the clock');
    if (!isTime(ms)) return fail('invalid-time', INVALID_TIME);
    if (ms > MAX_TIME_MS) {
      return fail('out-of-range', `time must be at most ${String(MAX_TIME_MS)} ms`);
    }
    pendingMs = ms % stepMs;
    timeMs = ms - pendingMs;
    dispatching = true;
    const failures = emit(Object.freeze({ type: 'set', timeMs }));
    dispatching = false;
    return finish(0, failures);
  }

  function tick(ms: unknown): ClockResult {
    if (dispatching) return fail('reentrant', 'a subscriber cannot move the clock');
    if (!isTime(ms)) return fail('invalid-time', INVALID_TIME);
    if (ms > maxTickMs) {
      return fail('tick-too-large', `one tick must be at most ${String(maxTickMs)} ms`);
    }
    if (timeMs + pendingMs + ms > MAX_TIME_MS) {
      return fail('out-of-range', `time must be at most ${String(MAX_TIME_MS)} ms`);
    }
    // While steps run, the remainder is held here: what a subscriber reads from the clock inside
    // a step must not depend on how the time was sliced into ticks.
    let budget = pendingMs + ms;
    pendingMs = 0;
    let steps = 0;
    let failures = 0;
    dispatching = true;
    // Bounded: budget < stepMs + maxTickMs, so at most maxStepsPerTick steps. `emit` never throws.
    while (budget >= stepMs) {
      budget -= stepMs;
      timeMs += stepMs;
      steps += 1;
      failures += emit(Object.freeze({ type: 'step', timeMs, stepMs }));
    }
    pendingMs = budget;
    dispatching = false;
    return finish(steps, failures);
  }

  function subscribe(listener: ClockListener): () => void {
    const subscription: Subscription = { listener, active: true };
    // A new array each time, so an event in progress keeps walking the list it started with.
    subscriptions = [...subscriptions, subscription];
    return () => {
      if (!subscription.active) return;
      subscription.active = false;
      subscriptions = subscriptions.filter((other) => other !== subscription);
    };
  }

  return {
    stepMs,
    maxTickMs,
    now: () => timeMs,
    snapshot: () => ({ timeMs, pendingMs, stepMs }),
    set,
    tick,
    subscribe,
  };
}
