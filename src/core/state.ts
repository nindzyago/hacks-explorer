/**
 * The state of the whole application: plain, frozen, JSON-safe data. It is what
 * `window.__app.state.get()` returns, so a field must never hold a function, a class instance,
 * a Map, a Date or `undefined`. A change is a new object put into the store.
 */
import { initialPlayer, type PlayerState } from './player/player';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Depth of the explanation (M1.4, S3): «Просто», «По шагам», «Глубже». */
export const DEPTHS = ['simple', 'steps', 'deep'] as const;
export type Depth = (typeof DEPTHS)[number];

export interface AppState {
  readonly theme: Theme;
  /** The lesson on the page (M1: one page, `lesson.open` switches it; addresses are M2). */
  readonly lesson: string;
  /**
   * The lesson player (M1.3, src/core/player): step, defence mode, playing, speed, and the clock
   * time at which the step started — the scene's message travels from there (design M1.2 E2).
   */
  readonly player: PlayerState;
  /**
   * Depth of the explanation panel (M1.4). It belongs to the reader, not to the step: changing
   * the step, the defence mode or the lesson keeps it (K71).
   */
  readonly depth: Depth;
}

export function initialState(): AppState {
  return Object.freeze({
    theme: 'light',
    lesson: 'I1',
    player: initialPlayer(),
    depth: 'simple',
  });
}
