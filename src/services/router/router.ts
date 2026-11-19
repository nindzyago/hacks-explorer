/**
 * The address bar and the application follow each other (M2.2, architecture §5). A thin adapter
 * over `address.ts`: it is handed the browser window, the state store and a way to run commands,
 * so it imports nothing above the core. Opening or reloading an address, back and forward run
 * commands (K13); a change of the state writes the address. See README.md.
 */
import { initialState, type AppState } from '../../core/state';
import { createStore, type Store } from '../../core/store';
import {
  formatAboutAddress,
  formatAddress,
  parseAddress,
  pathLanguage,
  type AddressOptions,
  type Place,
} from './address';

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
  /** Languages the site has (content/locales/languages.md). Russian alone when not given. */
  readonly languages?: readonly string[];
  /**
   * The language for an address without one (`/`) or with one the site does not have: the
   * reader's choice or the browser's (M2.3, K96). The first site language when not given.
   */
  readonly preferred?: string;
}

export interface Router {
  /** True while the address is no page of the site: the interface shows a message (L0.1). */
  readonly notFound: Pick<Store<boolean>, 'get' | 'subscribe'>;
  /**
   * True while the address is the page «About» (M3.9, `/<lang>/about`). The lesson stays in the
   * state behind it; a language switch keeps the page, opening another lesson leaves it.
   */
  readonly about: Pick<Store<boolean>, 'get' | 'subscribe'>;
  /**
   * Opens a path of this site as a new history entry, as a link would without loading the page.
   * Anything that is not a page of the site (another origin, no page, too long) is ignored (L0.2).
   */
  navigate(path: unknown): void;
  /** The language of the page, as the address shows it (`state.locale`). */
  lang(): string;
  /**
   * True while the state changes because the address was opened or Back / Forward was pressed:
   * such a change shows the address, it is not the reader's choice (`src/main.ts` remembers
   * only the reader's choice of language, K108).
   */
  applyingAddress(): boolean;
  stop(): void;
}

export const SITE_LANGUAGES: readonly string[] = ['ru'];

export function startRouter(options: RouterOptions): Router {
  const { window: win, store, run } = options;
  const languages = options.languages ?? SITE_LANGUAGES;
  const address: AddressOptions = {
    languages,
    fallback:
      options.preferred !== undefined && languages.includes(options.preferred)
        ? options.preferred
        : (languages[0] ?? 'ru'),
    // The default lesson is the one the application starts with (owner decides in M2.1).
    home: initialState().lesson,
  };
  const notFound = createStore(false);
  const about = createStore(false);
  /** The lesson behind the page «About» when it opened: another one leaves the page. */
  let aboutLesson = store.get().lesson;
  about.subscribe((on) => {
    if (on) aboutLesson = store.get().lesson;
  });
  /** While the address is being applied, the state changes in steps: nothing is written. */
  let applying = false;

  const current = () => `${win.location.pathname}${win.location.hash}`;
  const placeOf = (state: AppState): Place => ({
    lang: state.locale,
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
      // «No such page» in the language of the address, when it has one of the site (K110).
      const lang = pathLanguage(win.location.pathname, languages);
      if (lang !== null && store.get().locale !== lang) {
        applying = true;
        try {
          run('locale.set', { lang });
        } finally {
          applying = false;
        }
      }
      about.set(false);
      notFound.set(true);
      return;
    }
    notFound.set(false);
    if (route.kind === 'about') {
      applying = true;
      try {
        if (store.get().locale !== route.lang) run('locale.set', { lang: route.lang });
      } finally {
        applying = false;
      }
      about.set(true);
      const canonical = formatAboutAddress(route.lang);
      if (canonical !== current()) win.history.replaceState(null, '', canonical);
      return;
    }
    about.set(false);
    const { place } = route;
    applying = true;
    try {
      if (store.get().locale !== place.lang) run('locale.set', { lang: place.lang });
      if (store.get().lesson !== place.lesson) run('lesson.open', { id: place.lesson });
      if (store.get().player.defence !== place.defence) run('defence.set', { on: place.defence });
      if (store.get().player.step !== place.step) run('player.goto', { step: place.step });
    } finally {
      applying = false;
    }
    write(false);
  }

  apply();

  /**
   * The state → the address: a new lesson or a new language is a new history entry (K79, K108:
   * Back undoes a language switch), a step or a mode replaces the current one.
   */
  const unsubscribe = store.subscribe((state) => {
    if (applying || notFound.get()) return;
    if (about.get()) {
      // M3.9: behind the page only a new language (a new entry, K108) or a new lesson (the page
      // is left for it, K79) changes the address; steps and modes write nothing.
      const shownAbout = parseAddress(win.location.pathname, win.location.hash, address);
      if (shownAbout.kind === 'about' && shownAbout.lang !== state.locale) {
        win.history.pushState(null, '', formatAboutAddress(state.locale));
      } else if (state.lesson !== aboutLesson) {
        about.set(false);
        write(true);
      }
      return;
    }
    const shown = parseAddress(win.location.pathname, win.location.hash, address);
    write(
      shown.kind === 'lesson' &&
        (shown.place.lesson !== state.lesson || shown.place.lang !== state.locale),
    );
  });

  win.addEventListener('popstate', apply);
  win.addEventListener('hashchange', apply);

  return {
    notFound: {
      get: () => notFound.get(),
      subscribe: (listener: (value: boolean) => void) => notFound.subscribe(listener),
    },
    about: {
      get: () => about.get(),
      subscribe: (listener: (value: boolean) => void) => about.subscribe(listener),
    },
    navigate(path: unknown) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
      const cut = path.indexOf('#');
      const pathname = cut < 0 ? path : path.slice(0, cut);
      const hash = cut < 0 ? '' : path.slice(cut);
      if (parseAddress(pathname, hash, address).kind === 'unknown') return;
      if (path === current()) return;
      win.history.pushState(null, '', path);
      apply();
    },
    lang: () => store.get().locale,
    applyingAddress: () => applying,
    stop() {
      unsubscribe();
      win.removeEventListener('popstate', apply);
      win.removeEventListener('hashchange', apply);
    },
  };
}
