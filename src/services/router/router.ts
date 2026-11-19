/**
 * The address bar and the application follow each other (M2.2, architecture §5). A thin adapter
 * over `address.ts`: it is handed the browser window, the state store and a way to run commands,
 * so it imports nothing above the core. Opening or reloading an address, back and forward run
 * commands (K13); a change of the state writes the address. See README.md.
 */
import { initialState, type AppState } from '../../core/state';
import { createStore, type Store } from '../../core/store';
import { formatAddress, parseAddress, type AddressOptions, type Place } from './address';

/** The parts of `window` the router uses. */
export interface RouterWindow {
  readonly location: { readonly pathname: string; readonly hash: string };
  readonly history: {
    pushState(data: null, unused: string, url: string): void;
    replaceState(data: null, unused: string, url: string): void;
  };
  addEventListener(type: 'popstate' | 'hashchange', listener: () => void): void;
  removeEventListener(type: 'popstate' | 'hashchange', listener: () => void): void;
}

export interface RouterOptions {
  readonly window: RouterWindow;
  readonly store: Store<AppState>;
  /** Runs a command by id, as the registry does; its result is not needed. */
  readonly run: (id: string, params: Readonly<Record<string, unknown>>) => unknown;
  /** Languages the site has; the first one is the fallback. Only Russian until M2.3. */
  readonly languages?: readonly string[];
}

export interface Router {
  /** True while the address is no page of the site: the interface shows a message (L0.1). */
  readonly notFound: Pick<Store<boolean>, 'get' | 'subscribe'>;
  /** The language of the address (the state has no language until M2.3). */
  lang(): string;
  stop(): void;
}

export const SITE_LANGUAGES: readonly string[] = ['ru'];

export function startRouter(options: RouterOptions): Router {
  const { window: win, store, run } = options;
  const languages = options.languages ?? SITE_LANGUAGES;
  const address: AddressOptions = {
    languages,
    fallback: languages[0] ?? 'ru',
    // The default lesson is the one the application starts with (owner decides in M2.1).
    home: initialState().lesson,
  };
  const notFound = createStore(false);
  let lang = address.fallback;
  /** While the address is being applied, the state changes in steps: nothing is written. */
  let applying = false;

  const current = () => `${win.location.pathname}${win.location.hash}`;
  const placeOf = (state: AppState): Place => ({
    lang,
    lesson: state.lesson,
    step: state.player.step,
    defence: state.player.defence,
  });

  function write(push: boolean): void {
    const next = formatAddress(placeOf(store.get()));
    if (next === current()) return;
    if (push) win.history.pushState(null, '', next);
    else win.history.replaceState(null, '', next);
  }

  /** The address → the state, by commands; then the address is rewritten to its canonical form. */
  function apply(): void {
    const route = parseAddress(win.location.pathname, win.location.hash, address);
    if (route.kind === 'unknown') {
      notFound.set(true);
      return;
    }
    notFound.set(false);
    const { place } = route;
    lang = place.lang;
    applying = true;
    try {
      if (store.get().lesson !== place.lesson) run('lesson.open', { id: place.lesson });
      if (store.get().player.defence !== place.defence) run('defence.set', { on: place.defence });
      if (store.get().player.step !== place.step) run('player.goto', { step: place.step });
    } finally {
      applying = false;
    }
    write(false);
  }

  apply();

  /** The state → the address: a new lesson is a new history entry, anything else replaces. */
  const unsubscribe = store.subscribe((state) => {
    if (applying || notFound.get()) return;
    const shown = parseAddress(win.location.pathname, win.location.hash, address);
    write(shown.kind === 'lesson' && shown.place.lesson !== state.lesson);
  });

  win.addEventListener('popstate', apply);
  win.addEventListener('hashchange', apply);

  return {
    notFound: {
      get: () => notFound.get(),
      subscribe: (listener: (value: boolean) => void) => notFound.subscribe(listener),
    },
    lang: () => lang,
    stop() {
      unsubscribe();
      win.removeEventListener('popstate', apply);
      win.removeEventListener('hashchange', apply);
    },
  };
}
