/**
 * The state of the whole application: plain, frozen, JSON-safe data. It is what
 * `window.__app.state.get()` returns, so a field must never hold a function, a class instance,
 * a Map, a Date or `undefined`. A change is a new object put into the store.
 */
import { initialPlayer, type PlayerState } from './player/player';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface AppState {
  readonly theme: Theme;
  /** The lesson on the page (M1: one page, `lesson.open` switches it; addresses are M2). */
  readonly lesson: string;
  /**
   * The lesson player (M1.3, src/core/player): step, defence mode, playing, speed, and the clock
   * time at which the step started — the scene's message travels from there (design M1.2 E2).
   */
  readonly player: PlayerState;
}

export function initialState(): AppState {
  return Object.freeze({ theme: 'light', lesson: 'B1', player: initialPlayer() });
}
