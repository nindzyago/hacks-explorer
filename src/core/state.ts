/**
 * The state of the whole application: plain, frozen, JSON-safe data. It is what
 * `window.__app.state.get()` returns, so a field must never hold a function, a class instance,
 * a Map, a Date or `undefined`. A change is a new object put into the store.
 */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** The largest step number a command accepts; the scene keeps a number past the end at the last. */
export const MAX_STEP = 100;

/**
 * What the scene shows (design M1.2 E10): the step number in the current mode (from 1), the
 * defence mode, and the player clock time at which the step started — the message travels from
 * there (E2). Set by the temporary commands `scene.step` and `scene.defence` until the player
 * (M1.3) owns it.
 */
export interface SceneState {
  readonly step: number;
  readonly defence: boolean;
  readonly startedMs: number;
}

export interface AppState {
  readonly theme: Theme;
  /** The lesson on the page (M1: one page, `lesson.open` switches it; addresses are M2). */
  readonly lesson: string;
  readonly scene: SceneState;
}

export function sceneState(step: number, defence: boolean, startedMs: number): SceneState {
  return Object.freeze({ step, defence, startedMs });
}

export function initialState(): AppState {
  return Object.freeze({ theme: 'light', lesson: 'B1', scene: sceneState(1, false, 0) });
}
