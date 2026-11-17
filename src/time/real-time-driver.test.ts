// Oracle: level D — the driver only turns frame times into whole milliseconds for the clock.
import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS, createClock } from '../core/clock';
import { createRealTimeDriver, type FrameSource } from './real-time-driver';

/** Frames by hand: the test decides what "now" is and when a frame fires. */
function fakeFrames() {
  let time = 0;
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  const frames: FrameSource = {
    now: () => time,
    request: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    },
  };
  return {
    frames,
    pending,
    /** Moves wall time to `at` and fires every frame that was requested. */
    frame(at: number) {
      time = at;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

describe('real-time driver', () => {
  it('does nothing until started and feeds whole milliseconds, carrying the fraction', () => {
    const clock = createClock();
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    expect(driver.running).toBe(false);
    expect(fake.pending.size).toBe(0);

    fake.frame(1000);
    driver.start();
    expect(driver.running).toBe(true);
    expect(fake.pending.size).toBe(1);
    fake.frame(1016.7);
    expect(clock.snapshot()).toMatchObject({ timeMs: 10, pendingMs: 6 });
    fake.frame(1033.4);
    expect(clock.snapshot()).toMatchObject({ timeMs: 30, pendingMs: 3 });
    fake.frame(1050.1);
    expect(clock.snapshot()).toMatchObject({ timeMs: 50, pendingMs: 0 });
    expect(fake.pending.size).toBe(1);
  });

  it('stop cancels the frame; start and stop can be repeated', () => {
    const clock = createClock();
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    driver.start();
    driver.start();
    expect(fake.pending.size).toBe(1);
    driver.stop();
    driver.stop();
    expect(driver.running).toBe(false);
    expect(fake.pending.size).toBe(0);
    fake.frame(500);
    expect(clock.now()).toBe(0);
    // Time that passed while stopped is not replayed.
    driver.start();
    fake.frame(520);
    expect(clock.now()).toBe(20);
  });

  it('a long pause (hidden tab) counts as one capped frame', () => {
    const clock = createClock();
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    driver.start();
    fake.frame(600_000);
    expect(clock.now()).toBe(100);
    driver.stop();
    const custom = createClock();
    const other = createRealTimeDriver(custom, fake.frames, { maxFrameMs: 30 });
    other.start();
    fake.frame(700_000);
    expect(custom.now()).toBe(30);
  });

  it('ignores a wall clock that goes backwards or is not a number', () => {
    const clock = createClock();
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    fake.frame(1000);
    driver.start();
    for (const at of [900, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 900]) {
      fake.frame(at);
      expect(clock.snapshot()).toMatchObject({ timeMs: 0, pendingMs: 0 });
      expect(driver.running).toBe(true);
    }
    fake.frame(920);
    expect(clock.now()).toBe(20);
  });

  it('falls back to the default cap on bad options and never exceeds one clock tick', () => {
    const fake = fakeFrames();
    for (const maxFrameMs of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 1e9]) {
      const clock = createClock({ maxStepsPerTick: 20 });
      const driver = createRealTimeDriver(clock, fake.frames, { maxFrameMs });
      driver.start();
      fake.frame(fake.frames.now() + 5000);
      expect(clock.now()).toBeGreaterThan(0);
      expect(clock.now()).toBeLessThanOrEqual(200);
      driver.stop();
    }
  });

  it('a subscriber may stop the driver from inside a step', () => {
    const clock = createClock();
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    clock.subscribe(() => {
      driver.stop();
    });
    driver.start();
    fake.frame(50);
    expect(driver.running).toBe(false);
    expect(fake.pending.size).toBe(0);
  });

  it('stops by itself when the clock reaches its end', () => {
    const clock = createClock();
    clock.set(MAX_TIME_MS - 10);
    const fake = fakeFrames();
    const driver = createRealTimeDriver(clock, fake.frames);
    driver.start();
    fake.frame(50);
    expect(driver.running).toBe(false);
    expect(fake.pending.size).toBe(0);
  });
});
