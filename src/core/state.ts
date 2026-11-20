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

/** The tabs of the side panel (M2.1b, E2): the lessons by section and the glossary. */
export const DRAWER_TABS = ['lessons', 'glossary'] as const;
export type DrawerTab = (typeof DRAWER_TABS)[number];

/**
 * How the lesson is drawn (M6.2, design M6 §5): the spatial scene or the sequence of messages
 * between lanes. Both follow the same player.
 */
export const VIEWS = ['scene', 'sequence'] as const;
export type View = (typeof VIEWS)[number];

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
  /**
   * The side panel (M2.1b, E2): closed (null) or open on a tab. `drawer.open` and `drawer.close`
   * change it. While it is open a glossary term (`glossary`) shows in the panel, not in place.
   */
  readonly drawer: DrawerTab | null;
  /**
   * The view of the lesson (M6.2): the scene or the sequence. It belongs to the reader, like the
   * depth: a change of step, mode, lesson or language keeps it; it is not in the address.
   */
  readonly view: View;
}

export function initialState(): AppState {
  return Object.freeze({
    theme: 'light',
    lesson: 'I1',
    player: initialPlayer(),
    depth: 'simple',
    glossary: null,
    locale: 'ru',
    drawer: null,
    view: 'scene',
  });
}
