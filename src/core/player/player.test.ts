// The player model (M1.3): pure functions of a state and a moment of the player clock.
import { describe, expect, it } from 'vitest';
import { TRAVEL_MS } from '../scene-layout/message';
import {
  advance,
  back,
  elapsedMs,
  goto,
  initialPlayer,
  isSpeed,
  needsTime,
  pause,
  play,
  PAUSE_MS,
  setDefence,
  setSpeed,
  stepCount,
  stepDurationMs,
  stepForward,
  withCounts,
  type PlayerState,
} from './player';

/** B1: five steps without the defence, five with it. */
const B1 = { without: 5, with: 5 };
const ready = (over: Partial<PlayerState> = {}): PlayerState => ({
  ...withCounts(initialPlayer(), B1),
  ...over,
});

describe('initial state', () => {
  it('is step 1 without the defence, paused, at speed 1, steps unknown', () => {
    expect(initialPlayer()).toEqual({
      step: 1,
      defence: false,
      startedMs: 0,
      playing: false,
      speed: 1,
      counts: { without: 0, with: 0 },
    });
    expect(Object.isFrozen(initialPlayer())).toBe(true);
  });
});

describe('stepping by hand', () => {
  it('step and back move one step, restart it at the clock time and stop playing', () => {
    const p = stepForward(ready({ playing: true }), 700);
    expect(p).toMatchObject({ step: 2, startedMs: 700, playing: false });
    expect(Object.isFrozen(p)).toBe(true);
    expect(back(p, 900)).toMatchObject({ step: 1, startedMs: 900, playing: false });
  });

  it('three steps then back gives exactly the state of the step before (S1)', () => {
    let p = ready();
    p = stepForward(p, 0);
    const third = stepForward(p, 0);
    const fourth = stepForward(third, 0);
    expect(fourth.step).toBe(4);
    expect(back(fourth, 0)).toEqual(third);
  });

  it('does nothing past the ends', () => {
    const last = ready({ step: 5, startedMs: 40 });
    expect(stepForward(last, 900)).toBe(last);
    const first = ready({ startedMs: 40 });
    expect(back(first, 900)).toBe(first);
  });

  it('steps freely while the lesson is not loaded, and back still stops at 1', () => {
    const p = stepForward(initialPlayer(), 10);
    expect(p.step).toBe(2);
    expect(back(back(p, 20), 30).step).toBe(1);
  });
});

describe('goto', () => {
  it('goes to the step, clamped to the steps of the mode', () => {
    expect(goto(ready(), 3, 50)).toMatchObject({ step: 3, startedMs: 50, playing: false });
    expect(goto(ready(), 99, 50).step).toBe(5);
    expect(goto(ready(), 0, 50).step).toBe(1);
    expect(goto(ready(), -7, 50).step).toBe(1);
  });

  it('turns hostile numbers into a step, never into NaN', () => {
    expect(goto(ready(), Number.NaN, 0).step).toBe(1);
    expect(goto(ready(), Number.POSITIVE_INFINITY, 0).step).toBe(5);
    expect(goto(ready(), 2.9, 0).step).toBe(2);
  });

  it('the same step again starts it again', () => {
    expect(goto(ready({ step: 2, startedMs: 10 }), 2, 500)).toMatchObject({
      step: 2,
      startedMs: 500,
    });
  });
});

describe('defence', () => {
  it('keeps the step number, restarts the step and stops playing', () => {
    const p = setDefence(ready({ step: 3, startedMs: 0, playing: true }), true, 400);
    expect(p).toMatchObject({ step: 3, defence: true, startedMs: 400, playing: false });
    expect(setDefence(p, false, 800)).toMatchObject({ step: 3, defence: false, startedMs: 800 });
  });

  it('clamps the step to the other mode', () => {
    const p = withCounts(initialPlayer(), { without: 5, with: 3 });
    expect(setDefence({ ...p, step: 5 }, true, 0).step).toBe(3);
  });
});

describe('counts', () => {
  it('a loaded lesson clamps the step but keeps its start', () => {
    const p = withCounts({ ...initialPlayer(), step: 9, startedMs: 30 }, B1);
    expect(p).toMatchObject({ step: 5, startedMs: 30, counts: B1 });
    expect(stepCount(p)).toBe(5);
  });

  it('bad counts become zero (unknown)', () => {
    const p = withCounts(initialPlayer(), { without: -1, with: Number.NaN });
    expect(p.counts).toEqual({ without: 0, with: 0 });
    expect(withCounts(initialPlayer(), { without: 2.5, with: 1e9 }).counts).toEqual({
      without: 2,
      with: 100,
    });
  });
});

describe('speed', () => {
  it('accepts only 0.5, 1 and 2', () => {
    expect([0.5, 1, 2].every(isSpeed)).toBe(true);
    expect([0, 1.5, 3, -1, Number.NaN, '1', null].some(isSpeed)).toBe(false);
  });

  it('scales the time of a step', () => {
    expect(stepDurationMs(1)).toBe(TRAVEL_MS + PAUSE_MS);
    expect(stepDurationMs(2)).toBe((TRAVEL_MS + PAUSE_MS) / 2);
    expect(stepDurationMs(0.5)).toBe((TRAVEL_MS + PAUSE_MS) * 2);
    expect(elapsedMs(ready({ startedMs: 100, speed: 2 }), 400)).toBe(600);
    expect(elapsedMs(ready({ startedMs: 500 }), 400)).toBe(0);
  });

  it('a change keeps the message where it is', () => {
    const p = ready({ startedMs: 0 });
    const faster = setSpeed(p, 2, 300);
    expect(faster.speed).toBe(2);
    expect(elapsedMs(faster, 300)).toBe(300);
    const slower = setSpeed(faster, 0.5, 400);
    expect(elapsedMs(slower, 400)).toBe(elapsedMs(faster, 400));
    expect(Number.isInteger(slower.startedMs)).toBe(true);
  });

  it('keeps the state for the same speed and keeps playing', () => {
    const p = ready({ playing: true });
    expect(setSpeed(p, 1, 50)).toBe(p);
    expect(setSpeed(p, 2, 50).playing).toBe(true);
  });
});

describe('play and pause', () => {
  it('play after the message arrived goes on to the next step at once', () => {
    const p = play(ready({ step: 2, startedMs: 0 }), TRAVEL_MS);
    expect(p).toMatchObject({ step: 3, startedMs: TRAVEL_MS, playing: true });
  });

  it('play while the message travels lets it finish', () => {
    expect(play(ready({ step: 2, startedMs: 0 }), 100)).toMatchObject({
      step: 2,
      startedMs: 0,
      playing: true,
    });
  });

  it('play on the last step starts the lesson from the first once its message arrived', () => {
    expect(play(ready({ step: 5, startedMs: 0 }), TRAVEL_MS)).toMatchObject({
      step: 1,
      startedMs: TRAVEL_MS,
      playing: true,
    });
  });

  // Verifier M1.3: a last message still on its way finishes first, then playing stops.
  it('play on the last step while its message travels lets it finish', () => {
    const p = play(ready({ step: 5, startedMs: 0 }), 100);
    expect(p).toMatchObject({ step: 5, startedMs: 0, playing: true });
    expect(advance(p, TRAVEL_MS)).toMatchObject({ step: 5, playing: false });
  });

  // Verifier M1.3: with no steps known (no lesson shown) play must not start the clock.
  it('play does nothing while the lesson has no steps', () => {
    const none = initialPlayer();
    expect(play(none, 5000)).toBe(none);
  });

  it('play while playing and pause while paused change nothing', () => {
    const playing = ready({ playing: true });
    expect(play(playing, 10)).toBe(playing);
    const paused = ready();
    expect(pause(paused)).toBe(paused);
    expect(pause(playing).playing).toBe(false);
  });
});

describe('autoplay by the player clock', () => {
  it('moves to the next step when travel and pause are over, from the exact boundary', () => {
    const p = ready({ playing: true, startedMs: 100 });
    const d = stepDurationMs(1);
    expect(advance(p, 100 + d - 10)).toBe(p);
    expect(advance(p, 100 + d)).toMatchObject({ step: 2, startedMs: 100 + d, playing: true });
    // A late tick still lands on the boundaries: the same moment gives the same state.
    expect(advance(p, 100 + 2 * d + 30)).toMatchObject({ step: 3, startedMs: 100 + 2 * d });
  });

  it('goes faster at speed 2 and slower at 0.5', () => {
    const fast = ready({ playing: true, speed: 2 });
    expect(advance(fast, stepDurationMs(2)).step).toBe(2);
    const slow = ready({ playing: true, speed: 0.5 });
    expect(advance(slow, stepDurationMs(1)).step).toBe(1);
    expect(advance(slow, stepDurationMs(0.5)).step).toBe(2);
  });

  it('stops on the last step once its message arrived', () => {
    const p = ready({ step: 4, playing: true });
    const d = stepDurationMs(1);
    const onLast = advance(p, d);
    expect(onLast).toMatchObject({ step: 5, playing: true });
    expect(advance(onLast, d + TRAVEL_MS - 10).playing).toBe(true);
    expect(advance(onLast, d + TRAVEL_MS)).toMatchObject({ step: 5, playing: false });
    // A jump far ahead lands on the last step, stopped.
    expect(advance(ready({ playing: true }), 1_000_000)).toMatchObject({
      step: 5,
      playing: false,
    });
  });

  it('does nothing when paused, before the clock reaches the step, or without steps', () => {
    const paused = ready();
    expect(advance(paused, 100_000)).toBe(paused);
    const early = ready({ playing: true, startedMs: 5000 });
    expect(advance(early, 0)).toBe(early);
    const unknown = { ...initialPlayer(), playing: true };
    expect(advance(unknown, 100_000)).toBe(unknown);
  });

  it('the result does not depend on how time was sliced', () => {
    let sliced = ready({ playing: true });
    for (let t = 0; t <= 9000; t += 10) sliced = advance(sliced, t);
    expect(sliced).toEqual(advance(ready({ playing: true }), 9000));
  });
});

describe('needsTime', () => {
  it('while playing or while the message travels', () => {
    expect(needsTime(ready({ playing: true }), 100_000)).toBe(true);
    expect(needsTime(ready({ startedMs: 0 }), TRAVEL_MS - 10)).toBe(true);
    expect(needsTime(ready({ startedMs: 0 }), TRAVEL_MS)).toBe(false);
    expect(needsTime(ready({ startedMs: 0, speed: 2 }), TRAVEL_MS / 2)).toBe(false);
  });

  it('never without steps: nothing is shown, so nothing moves', () => {
    expect(needsTime({ ...initialPlayer(), playing: true }, 100_000)).toBe(false);
    expect(needsTime(initialPlayer(), 0)).toBe(false);
  });
});
