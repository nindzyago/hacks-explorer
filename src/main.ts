import { mount } from 'svelte';
import siteLocales from 'virtual:site-locales';
import { createApp } from './commands/app';
import { installControl } from './control/control';
import { createLessonLoader } from './services/catalog/catalog';
import { createGlossaryLoader } from './services/glossary/glossary';
import {
  chooseLanguage,
  readLocales,
  rememberLanguage,
  storedLanguage,
} from './services/i18n/i18n';
import { startRouter } from './services/router/router';
import { createRealTimeDriver } from './time/real-time-driver';
import App from './ui/App.svelte';
import './ui/tokens.css';
import './ui/fonts.css';
import './ui/base.css';

const target = document.getElementById('app');
if (target === null) throw new Error('index.html has no #app element');

// The site languages and their interface strings, bundled and complete (M2.3, K94, K105).
const read = readLocales(siteLocales);
if (!read.ok) throw new Error(`the bundled interface strings are broken: ${read.error.message}`);
const locales = read.value;
const languages = locales.languages.map((l) => l.code);

// The running site has a live clock: wall time goes into the player clock once per frame, while
// the player needs it (playing, or a message on its way; K17, K68). The first move of the clock
// by a command (a test, the control channel) stops that for good, so wall time never mixes into
// a scripted run.
const live: { manual: boolean; driver?: { start(): void; stop(): void } } = { manual: false };
const app = createApp({
  onManualClock: () => {
    live.manual = true;
    live.driver?.stop();
  },
  onTimeNeeded: (needed) => {
    if (live.manual) return;
    if (needed) live.driver?.start();
    else live.driver?.stop();
  },
  languages,
});
const driver = createRealTimeDriver(app.clock);
live.driver = driver;
if (app.timeNeeded()) driver.start();

// The control channel exists in the dev server and in the e2e build (`vite build --mode e2e`).
// In the production build this condition is the constant `false` and the bundler drops the code.
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  installControl(window, app);
}

// Lesson data the build put into data/ (K37), fetched from this site only.
const loader = createLessonLoader({
  fetch: (url) => window.fetch(url),
  base: import.meta.env.BASE_URL,
});

// The glossary (M2.4) loads the first time a reader opens a term.
const glossary = createGlossaryLoader({
  fetch: (url) => window.fetch(url),
  base: import.meta.env.BASE_URL,
});

// The language (M2.3, D3, K96): the address wins; without one, what the reader chose before
// (localStorage), else the browser's languages. Storage is hostile and may throw (L0.2).
const storage = () => window.localStorage;
const preferred = chooseLanguage({
  stored: storedLanguage(storage),
  browser: navigator.languages,
  languages,
});
app.registry.run('locale.set', { lang: preferred });

// The address holds the place in the lesson (M2.2, architecture §5). It is applied through
// commands before the page is drawn, so the first lesson loaded is the one in the address.
const router = startRouter({
  window,
  store: app.store,
  run: (id, params) => app.registry.run(id, params),
  languages,
  preferred,
});

// Only the reader's own choice of language is remembered for the next visit: the switch or the
// control channel. A language that comes from the address (the page opened with it, Back and
// Forward) is shown, not remembered (K108).
let shownLocale = app.store.get().locale;
app.store.subscribe((state) => {
  if (state.locale === shownLocale) return;
  shownLocale = state.locale;
  if (!router.applyingAddress()) rememberLanguage(storage, state.locale);
});

mount(App, {
  target,
  props: {
    app,
    loader,
    glossary,
    locales,
    home: import.meta.env.BASE_URL,
    notFound: router.notFound,
  },
});
