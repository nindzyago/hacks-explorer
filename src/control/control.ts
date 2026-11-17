/**
 * Control channel (architecture §4): `window.__app`, the way Playwright and agents drive the
 * site. It exists only in the dev server and in the e2e build; `src/main.ts` decides that, and
 * e2e/production.spec.ts proves the production build has no trace of it. See README.md.
 */
import type { AppContext } from '../commands/app';
import { createClockChannel, type ClockChannel } from '../commands/clock';
import type { CommandInfo, RunResult } from '../commands/registry';
import type { ClockSnapshot } from '../core/clock';
import type { AppState } from '../core/state';

/** What `state.get()` returns: the stored state and, next to it, the player clock (K17). */
export type ControlState = AppState & { readonly clock: ClockSnapshot };

export interface AppControl {
  readonly commands: {
    /** Every command, as plain data. */
    list(): CommandInfo[];
    /** Never throws; `id` and `params` may be anything. */
    run(id: unknown, params?: unknown): RunResult;
  };
  readonly state: {
    /** A copy of the application state and of the clock, as plain data. */
    get(): ControlState;
  };
  /**
   * Moves the player clock by hand: the commands `clock.set` and `clock.tick`. Never throws;
   * `ms` may be anything. The first accepted move stops the real-time driver.
   */
  readonly clock: ClockChannel;
}

declare global {
  interface Window {
    /** Present only in the dev server and in the e2e build. */
    __app?: AppControl;
  }
}

export function createControl(app: AppContext): AppControl {
  const run = (id: unknown, params?: unknown): RunResult => {
    try {
      // A copy: the caller gets data it may change without touching the application.
      return structuredClone(app.registry.run(id, params));
    } catch {
      // The registry promises not to throw; the channel does not rely on that promise.
      return {
        ok: false,
        error: { code: 'failed', commandId: '', message: 'control channel failed' },
      };
    }
  };
  return Object.freeze({
    commands: Object.freeze({
      list: () => structuredClone(app.registry.list()),
      run,
    }),
    state: Object.freeze({
      get: () => structuredClone({ ...app.store.get(), clock: app.clock.snapshot() }),
    }),
    // The same commands by id, through the same safe `run`.
    clock: Object.freeze(createClockChannel({ run })),
  });
}

/** Puts the channel on `target` (the window) as `__app`; a page script cannot replace it. */
export function installControl(target: { __app?: AppControl }, app: AppContext): AppControl {
  const control = createControl(app);
  Object.defineProperty(target, '__app', {
    value: control,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  return control;
}
