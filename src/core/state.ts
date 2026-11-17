/**
 * The state of the whole application: plain, frozen, JSON-safe data. It is what
 * `window.__app.state.get()` returns, so a field must never hold a function, a class instance,
 * a Map, a Date or `undefined`. A change is a new object put into the store.
 */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface AppState {
  readonly theme: Theme;
}

export function initialState(): AppState {
  return Object.freeze({ theme: 'light' });
}
