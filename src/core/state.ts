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
  /**
   * The glossary term whose definition is open in place (M2.4, K7), or null. One at a time;
   * `glossary.open` and `glossary.close` change it.
   */
  readonly glossary: string | null;
  /**
   * The language of the page (M2.3): of the interface, the lesson, the glossary and the address.
   * One of the site languages; `locale.set` changes it and keeps the lesson, step, mode and depth.
   */
  readonly locale: string;
}

export function initialState(): AppState {
  return Object.freeze({
    theme: 'light',
    lesson: 'I1',
    player: initialPlayer(),
    depth: 'simple',
    glossary: null,
    locale: 'ru',
  });
}
