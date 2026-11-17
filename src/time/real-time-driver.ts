/**
 * Real-time driver: on the running site it feeds wall time into the player clock, once per
 * animation frame. This is the only file of the site that may read system time or schedule
 * frames (ESLint enforces it, see scripts/timing-rules.mjs). Tests and the control channel
 * stop it and move the clock by hand. See README.md.
 */
import type { Clock } from '../core/clock';

/** Where frames and wall time come from; tests pass their own. */
export interface FrameSource {
  /** Milliseconds from any fixed moment; may be fractional. */
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const browserFrames: FrameSource = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => {
    cancelAnimationFrame(handle);
  },
};

export const DEFAULT_MAX_FRAME_MS = 100;

export interface RealTimeDriverOptions {
  /** A frame longer than this (hidden tab, debugger) counts as this much. */
  readonly maxFrameMs?: number | undefined;
}

export interface RealTimeDriver {
  readonly running: boolean;
  /** Starts feeding time from this moment. Does nothing when already running. */
  start(): void;
  /** Stops and cancels the requested frame. Time that passes while stopped is never replayed. */
  stop(): void;
}

export function createRealTimeDriver(
  clock: Pick<Clock, 'tick' | 'maxTickMs'>,
  frames: FrameSource = browserFrames,
  options: RealTimeDriverOptions = {},
): RealTimeDriver {
  const wanted = options.maxFrameMs ?? DEFAULT_MAX_FRAME_MS;
  const maxFrameMs = Math.min(
    Number.isFinite(wanted) && wanted >= 1 ? wanted : DEFAULT_MAX_FRAME_MS,
    clock.maxTickMs,
  );

  let running = false;
  let handle: number | null = null;
  let lastMs = 0;
  /** Fraction of a millisecond not yet given to the clock. */
  let carryMs = 0;

  function stop(): void {
    running = false;
    if (handle !== null) frames.cancel(handle);
    handle = null;
  }

  function schedule(): void {
    if (running && handle === null) handle = frames.request(frame);
  }

  function frame(): void {
    handle = null;
    if (!running) return;
    const nowMs = frames.now();
    if (Number.isFinite(nowMs)) {
      const delta = nowMs - lastMs;
      lastMs = nowMs;
      if (delta > 0) {
        carryMs += Math.min(delta, maxFrameMs);
        const whole = Math.floor(carryMs);
        carryMs -= whole;
        const result = clock.tick(whole);
        // The clock is full (24 hours): nothing more to feed.
        if (!result.ok && result.error.code === 'out-of-range') stop();
      }
    }
    // A subscriber may have stopped or restarted the driver during the tick.
    schedule();
  }

  function start(): void {
    if (running) return;
    running = true;
    const nowMs = frames.now();
    lastMs = Number.isFinite(nowMs) ? nowMs : 0;
    carryMs = 0;
    schedule();
  }

  return {
    get running() {
      return running;
    },
    start,
    stop,
  };
}
