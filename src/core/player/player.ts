/**
 * The lesson player (M1.3, architecture §3): which step is current, the defence mode, playing or
 * paused, and the speed. Pure: every function takes a state and a moment of the player clock and
 * returns a new frozen state (or the same object when nothing changes). There are no timers:
 * autoplay moves on only when `advance` is called with a later clock time (K17). See README.md.
 */
import { TRAVEL_MS } from '../scene-layout/message';

/** After a message arrives, autoplay waits this long before the next step (as the prototype). */
export const PAUSE_MS = 1500;
export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];
/** The largest number of steps a mode may have; a larger count is cut to it. */
export const MAX_STEPS = 100;

/** How many steps each mode of the open lesson has; 0 while the lesson is not loaded. */
export interface StepCounts {
  readonly without: number;
  readonly with: number;
}

export interface PlayerState {
  /** The step number in the current mode, from 1. */
  readonly step: number;
  readonly defence: boolean;
  /** Player clock time at which the current step started: its message travels from there. */
  readonly startedMs: number;
  readonly playing: boolean;
  readonly speed: Speed;
  readonly counts: StepCounts;
}

function freeze(state: PlayerState): PlayerState {
  return Object.freeze({ ...state, counts: Object.freeze({ ...state.counts }) });
}

export function initialPlayer(): PlayerState {
  return freeze({
    step: 1,
    defence: false,
    startedMs: 0,
    playing: false,
    speed: 1,
    counts: { without: 0, with: 0 },
  });
}

export function isSpeed(value: unknown): value is Speed {
  return SPEEDS.some((speed) => speed === value);
}

/** Steps of the current mode; 0 while unknown. */
export function stepCount(state: PlayerState): number {
  return state.defence ? state.counts.with : state.counts.without;
}

/** Player clock time one step takes when it plays on its own: travel, then the pause. */
export function stepDurationMs(speed: Speed): number {
  return Math.round((TRAVEL_MS + PAUSE_MS) / speed);
}

/** Lesson time since the step started at `nowMs`: player clock time times the speed, ≥ 0. */
export function elapsedMs(state: Pick<PlayerState, 'startedMs' | 'speed'>, nowMs: number): number {
  return Math.max(0, nowMs - state.startedMs) * state.speed;
}

/** A whole step number from 1; past the end of a known mode, its last step. */
function clampStep(wanted: number, count: number): number {
  const whole = Number.isNaN(wanted)
    ? 1
    : Number.isFinite(wanted)
      ? Math.floor(wanted)
      : wanted > 0
        ? Math.max(count, 1)
        : 1;
  const low = Math.max(1, whole);
  return count > 0 ? Math.min(count, low) : Math.min(MAX_STEPS, low);
}

function countOf(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_STEPS, Math.floor(value));
}

/** The lesson's steps became known: the step is kept inside them, its start is kept. */
export function withCounts(state: PlayerState, counts: StepCounts): PlayerState {
  const next = {
    ...state,
    counts: { without: countOf(counts.without), with: countOf(counts.with) },
  };
  return freeze({ ...next, step: clampStep(state.step, stepCount(next)) });
}

/** Step `step` of the current mode, started now; stops playing (a step chosen by hand). */
export function goto(state: PlayerState, step: number, nowMs: number): PlayerState {
  return freeze({
    ...state,
    step: clampStep(step, stepCount(state)),
    startedMs: nowMs,
    playing: false,
  });
}

/** The next step, started now; on the last step nothing changes. */
export function stepForward(state: PlayerState, nowMs: number): PlayerState {
  const count = stepCount(state);
  if (count > 0 && state.step >= count) return state;
  return goto(state, state.step + 1, nowMs);
}

/** The step before, started now; on the first step nothing changes. */
export function back(state: PlayerState, nowMs: number): PlayerState {
  if (state.step <= 1) return state;
  return goto(state, state.step - 1, nowMs);
}

/** The defence mode on or off: the same step number in that mode, started again, paused. */
export function setDefence(state: PlayerState, on: boolean, nowMs: number): PlayerState {
  return goto({ ...state, defence: on }, state.step, nowMs);
}

/**
 * Starts autoplay. A message still on its way finishes first (on the last step too: then playing
 * stops when it arrives); one that has arrived goes on to the next step at once, and after the
 * last step the lesson starts again from the first (as the prototype). Without steps (no lesson
 * shown) nothing changes.
 */
export function play(state: PlayerState, nowMs: number): PlayerState {
  if (state.playing) return state;
  const count = stepCount(state);
  if (count === 0) return state;
  if (elapsedMs(state, nowMs) < TRAVEL_MS) return freeze({ ...state, playing: true });
  if (state.step >= count) return freeze({ ...state, step: 1, startedMs: nowMs, playing: true });
  return freeze({ ...state, step: state.step + 1, startedMs: nowMs, playing: true });
}

/** Stops autoplay; a message on its way still arrives. */
export function pause(state: PlayerState): PlayerState {
  return state.playing ? freeze({ ...state, playing: false }) : state;
}

/** A new speed; the message stays where it is (its lesson time is kept), playing goes on. */
export function setSpeed(state: PlayerState, speed: Speed, nowMs: number): PlayerState {
  if (state.speed === speed) return state;
  const lesson = Math.min(elapsedMs(state, nowMs), TRAVEL_MS + PAUSE_MS);
  return freeze({ ...state, speed, startedMs: nowMs - Math.round(lesson / speed) });
}

/**
 * Autoplay at clock time `nowMs`: every step whose travel and pause are over gives way to the
 * next, which starts at that exact boundary, so the result does not depend on how often this is
 * called. On the last step playing stops once its message has arrived.
 */
export function advance(state: PlayerState, nowMs: number): PlayerState {
  if (!state.playing) return state;
  const count = stepCount(state);
  if (count === 0) return state;
  const duration = stepDurationMs(state.speed);
  const travel = Math.round(TRAVEL_MS / state.speed);
  let { step, startedMs } = state;
  // Bounded: at most `count` steps.
  while (step < count && nowMs - startedMs >= duration) {
    step += 1;
    startedMs += duration;
  }
  const ended = step >= count && nowMs - startedMs >= travel;
  if (step === state.step && !ended) return state;
  return freeze({ ...state, step, startedMs, playing: !ended });
}

/**
 * Whether the player clock has to run: the lesson has steps, and autoplay is on or the message is
 * still on its way. Without steps nothing is shown, so nothing needs time.
 */
export function needsTime(state: PlayerState, nowMs: number): boolean {
  if (stepCount(state) === 0) return false;
  return state.playing || elapsedMs(state, nowMs) < TRAVEL_MS;
}
