/**
 * Control channel (architecture §4): `window.__app`, the way Playwright and agents drive the
 * site. It exists only in the dev server and in the e2e build; `src/main.ts` decides that, and
 * e2e/production.spec.ts proves the production build has no trace of it. See README.md.
 */
import type { AppContext } from '../commands/app';
import type { CommandInfo, RunResult } from '../commands/registry';
import type { AppState } from '../core/state';

export interface AppControl {
  readonly commands: {
    /** Every command, as plain data. */
    list(): CommandInfo[];
    /** Never throws; `id` and `params` may be anything. */
    run(id: unknown, params?: unknown): RunResult;
  };
  readonly state: {
    /** A copy of the application state, as plain data. */
    get(): AppState;
  };
  // EXTENSION POINT (M0.4): `readonly clock: { set(ms: unknown): …; tick(ms: unknown): … }`.
}

declare global {
  interface Window {
    /** Present only in the dev server and in the e2e build. */
    __app?: AppControl;
  }
}

export function createControl(app: AppContext): AppControl {
  return Object.freeze({
    commands: Object.freeze({
      // Copies: the caller gets data it may change without touching the application.
      list: () => structuredClone(app.registry.list()),
      run: (id: unknown, params?: unknown): RunResult => {
        try {
          return structuredClone(app.registry.run(id, params));
        } catch {
          // The registry promises not to throw; the channel does not rely on that promise.
          return {
            ok: false,
            error: { code: 'failed', commandId: '', message: 'control channel failed' },
          };
        }
      },
    }),
    state: Object.freeze({
      get: () => structuredClone(app.store.get()),
    }),
    // EXTENSION POINT (M0.4): `clock: Object.freeze({ set: …, tick: … })`, built from `app`.
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
