// M2.2, oracle level D (S4): the address and the state follow each other. The address is applied
// through commands (K13); commands write the address back: a new lesson is a new history entry,
// a step or a mode replaces the current one.
import { describe, expect, it } from 'vitest';
import { goto, initialPlayer, setDefence, withCounts } from '../../core/player/player';
import { initialState, type AppState } from '../../core/state';
import { createStore, type Store } from '../../core/store';
import { startRouter, type RouterWindow } from './router';

/** A browser history in memory: entries, the current one, popstate on back and forward. */
function fakeWindow(start: string) {
  const entries: string[] = [start];
  let index = 0;
  const listeners = new Map<string, Set<() => void>>();
  const split = (url: string) => {
    const cut = url.indexOf('#');
    return cut < 0
      ? { pathname: url, hash: '' }
      : { pathname: url.slice(0, cut), hash: url.slice(cut) };
  };
  const location = { pathname: '', hash: '' };
  const show = () => {
    const at = entries[index] ?? '/';
    Object.assign(location, split(at));
  };
  show();
  const fire = (type: string) => {
    for (const listener of listeners.get(type) ?? []) listener();
  };
  const win: RouterWindow = {
    location,
    history: {
      pushState: (_data, _unused, url) => {
        entries.splice(index + 1, entries.length, url);
        index += 1;
        show();
      },
      replaceState: (_data, _unused, url) => {
        entries[index] = url;
        show();
      },
    },
    addEventListener: (type, listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
  };
  return {
    win,
    entries,
    address: () => `${location.pathname}${location.hash}`,
    go(delta: number) {
      index = Math.max(0, Math.min(entries.length - 1, index + delta));
      show();
      fire('popstate');
    },
    /** The reader edits the hash in the address bar. */
    editHash(hash: string) {
      entries.splice(index + 1, entries.length, `${location.pathname}${hash}`);
      index += 1;
      show();
      fire('popstate');
      fire('hashchange');
    },
  };
}

/** The player commands, as src/commands/player.ts runs them, on a store; logs every call. */
function fakeApp() {
  const store: Store<AppState> = createStore(initialState());
  const calls: string[] = [];
  const update = (next: Partial<AppState>) => {
    store.set(Object.freeze({ ...store.get(), ...next }));
  };
  const run = (id: string, params: Readonly<Record<string, unknown>> = {}) => {
    calls.push(`${id} ${JSON.stringify(params)}`);
    const { player, lesson } = store.get();
    if (id === 'lesson.open' && typeof params['id'] === 'string') {
      update({ lesson: params['id'], player: params['id'] === lesson ? player : initialPlayer() });
    } else if (id === 'defence.set' && typeof params['on'] === 'boolean') {
      update({ player: setDefence(player, params['on'], 0) });
    } else if (id === 'player.goto' && typeof params['step'] === 'number') {
      update({ player: goto(player, params['step'], 0) });
    } else if (id === 'defence.toggle') {
      update({ player: setDefence(player, !player.defence, 0) });
    } else if (id === 'locale.set' && typeof params['lang'] === 'string') {
      update({ locale: params['lang'] });
    }
  };
  const loaded = (without: number, withDefence: number) => {
    update({ player: withCounts(store.get().player, { without, with: withDefence }) });
  };
  return { store, run, calls, loaded };
}

function setup(start: string) {
  const browser = fakeWindow(start);
  const app = fakeApp();
  const router = startRouter({ window: browser.win, store: app.store, run: app.run });
  return { browser, app, router };
}

describe('startRouter', () => {
  it('S4: the address opens lesson, step and mode through commands', () => {
    const { app, browser, router } = setup('/ru/lesson/I1#step-3-defence');
    expect(app.calls).toEqual(['defence.set {"on":true}', 'player.goto {"step":3}']);
    const { lesson, player } = app.store.get();
    expect([lesson, player.step, player.defence]).toEqual(['I1', 3, true]);
    expect(browser.address()).toBe('/ru/lesson/I1#step-3-defence');
    expect(browser.entries).toHaveLength(1);
    expect(router.notFound.get()).toBe(false);
  });

  it('another lesson is opened with lesson.open', () => {
    const { app } = setup('/ru/lesson/B1#step-2');
    expect(app.calls).toEqual(['lesson.open {"id":"B1"}', 'player.goto {"step":2}']);
  });

  it('the home page opens the default lesson and rewrites the address without a new entry', () => {
    const { app, browser } = setup('/');
    expect(app.calls).toEqual([]);
    expect(browser.address()).toBe('/ru/lesson/I1');
    expect(browser.entries).toEqual(['/ru/lesson/I1']);
  });

  it('a forgiven address is rewritten to its canonical form', () => {
    const { browser } = setup('/EN/lesson/i1/#step-0');
    expect(browser.address()).toBe('/ru/lesson/I1');
    expect(browser.entries).toHaveLength(1);
  });

  it('a step past the end is cut when the lesson loads, and the address follows', () => {
    const { app, browser } = setup('/ru/lesson/I1#step-9-defence');
    expect(browser.address()).toBe('/ru/lesson/I1#step-9-defence');
    app.loaded(5, 4);
    expect(app.store.get().player.step).toBe(4);
    expect(browser.address()).toBe('/ru/lesson/I1#step-4-defence');
  });

  it('steps and modes replace the entry; a new lesson pushes one', () => {
    const { app, browser } = setup('/ru/lesson/I1');
    app.loaded(5, 5);
    app.run('player.goto', { step: 2 });
    expect(browser.address()).toBe('/ru/lesson/I1#step-2');
    app.run('defence.toggle');
    expect(browser.address()).toBe('/ru/lesson/I1#step-2-defence');
    app.run('player.goto', { step: 1 });
    app.run('defence.toggle');
    expect(browser.address()).toBe('/ru/lesson/I1');
    expect(browser.entries).toEqual(['/ru/lesson/I1']);
    app.run('lesson.open', { id: 'B1' });
    expect(browser.entries).toEqual(['/ru/lesson/I1', '/ru/lesson/B1']);
  });

  it('back and forward apply the address of the entry', () => {
    const { app, browser } = setup('/ru/lesson/I1#step-3-defence');
    app.loaded(5, 5);
    app.run('lesson.open', { id: 'B1' });
    app.loaded(4, 4);
    app.run('player.goto', { step: 2 });
    expect(browser.entries).toEqual(['/ru/lesson/I1#step-3-defence', '/ru/lesson/B1#step-2']);
    browser.go(-1);
    const back = app.store.get();
    expect([back.lesson, back.player.step, back.player.defence]).toEqual(['I1', 3, true]);
    expect(browser.address()).toBe('/ru/lesson/I1#step-3-defence');
    browser.go(1);
    const forward = app.store.get();
    expect([forward.lesson, forward.player.step, forward.player.defence]).toEqual(['B1', 2, false]);
    expect(browser.entries).toHaveLength(2);
  });

  it('a hash edited by hand is applied once; garbage gives step 1', () => {
    const { app, browser } = setup('/ru/lesson/I1');
    app.loaded(5, 5);
    app.calls.length = 0;
    browser.editHash('#step-4');
    expect(app.calls).toEqual(['player.goto {"step":4}']);
    browser.editHash('#<script>');
    expect(app.store.get().player.step).toBe(1);
    expect(browser.address()).toBe('/ru/lesson/I1');
  });

  it('an unknown path is «not found»: no commands, the address is left alone', () => {
    for (const path of ['/ru/lesson/__proto__', '/ru/lesson/../I1', '/xx/yy', '/ru/lesson/I1/x']) {
      const { app, browser, router } = setup(path);
      expect(router.notFound.get(), path).toBe(true);
      expect(app.calls).toEqual([]);
      app.run('defence.toggle');
      expect(browser.address()).toBe(path);
    }
  });

  it('stop() removes the listeners and the subscription', () => {
    const { app, browser, router } = setup('/ru/lesson/I1');
    router.stop();
    app.run('player.goto', { step: 3 });
    expect(browser.address()).toBe('/ru/lesson/I1');
    browser.editHash('#step-2');
    expect(app.store.get().player.step).toBe(3);
  });

  it('a site with English keeps it in the address', () => {
    const browser = fakeWindow('/en/lesson/I1#step-2');
    const app = fakeApp();
    const router = startRouter({
      window: browser.win,
      store: app.store,
      run: app.run,
      languages: ['ru', 'en'],
    });
    expect(router.lang()).toBe('en');
    expect(app.calls[0]).toBe('locale.set {"lang":"en"}');
    app.run('defence.toggle');
    expect(browser.address()).toBe('/en/lesson/I1#step-2-defence');
  });

  // M2.3 (S5, K96): the language is in the state; the address wins, then the reader's choice.
  // Verifier M2.3a (K108): a language switch is a navigation the reader can undo.
  it('locale.set is a new history entry, keeping the step and mode; Back undoes it', () => {
    const browser = fakeWindow('/ru/lesson/B1#step-3');
    const app = fakeApp();
    const router = startRouter({
      window: browser.win,
      store: app.store,
      run: app.run,
      languages: ['ru', 'en'],
    });
    app.run('locale.set', { lang: 'en' });
    expect(browser.address()).toBe('/en/lesson/B1#step-3');
    expect(browser.entries).toEqual(['/ru/lesson/B1#step-3', '/en/lesson/B1#step-3']);
    browser.editHash('#step-2');
    expect(app.store.get().locale).toBe('en');
    expect(browser.address()).toBe('/en/lesson/B1#step-2');
    browser.go(-1);
    browser.go(-1);
    expect(app.store.get().locale).toBe('ru');
    expect(browser.address()).toBe('/ru/lesson/B1#step-3');
    browser.go(1);
    expect(app.store.get().locale).toBe('en');
    expect(router.applyingAddress()).toBe(false);
  });

  it('says while a language change comes from the address, not from the reader', () => {
    const browser = fakeWindow('/ru/lesson/B1');
    const app = fakeApp();
    const router = startRouter({
      window: browser.win,
      store: app.store,
      run: app.run,
      languages: ['ru', 'en'],
    });
    const seen: [string, boolean][] = [];
    app.store.subscribe((state) => seen.push([state.locale, router.applyingAddress()]));
    seen.length = 0; // the store calls a new subscriber at once with the current state
    app.run('locale.set', { lang: 'en' });
    browser.go(-1);
    expect(seen).toEqual([
      ['en', false],
      ['ru', true],
    ]);
  });

  it('an unknown path with a site language shows not-found in that language', () => {
    const browser = fakeWindow('/en/nope');
    const app = fakeApp();
    const router = startRouter({
      window: browser.win,
      store: app.store,
      run: app.run,
      languages: ['ru', 'en'],
    });
    expect(router.notFound.get()).toBe(true);
    expect(app.calls).toEqual(['locale.set {"lang":"en"}']);
    expect(browser.address()).toBe('/en/nope');
    for (const start of ['/de/nope', '/nope/more', '/EN/nope', '/en']) {
      const other = fakeWindow(start);
      const otherApp = fakeApp();
      startRouter({
        window: other.win,
        store: otherApp.store,
        run: otherApp.run,
        languages: ['ru', 'en'],
      });
      if (start === '/en') continue; // a home address, applied as usual
      expect(otherApp.calls.filter((c) => c.startsWith('locale.set'))).toEqual(
        start === '/EN/nope' ? ['locale.set {"lang":"en"}'] : [],
      );
    }
  });

  it('an address without a language, or with one the site lacks, takes the preferred one', () => {
    for (const [start, want] of [
      ['/', '/en/lesson/I1'],
      ['/de/lesson/B1', '/en/lesson/B1'],
      ['/ru/lesson/B1', '/ru/lesson/B1'],
    ] as const) {
      const browser = fakeWindow(start);
      const app = fakeApp();
      startRouter({
        window: browser.win,
        store: app.store,
        run: app.run,
        languages: ['ru', 'en'],
        preferred: 'en',
      });
      expect(browser.address()).toBe(want);
    }
  });

  it('a preferred language the site does not have is ignored', () => {
    const browser = fakeWindow('/');
    const app = fakeApp();
    startRouter({ window: browser.win, store: app.store, run: app.run, preferred: 'en' });
    expect(browser.address()).toBe('/ru/lesson/I1');
    expect(app.calls).toEqual([]);
  });

  it('back and forward bring back the language of that entry', () => {
    const browser = fakeWindow('/en/lesson/I1');
    const app = fakeApp();
    startRouter({ window: browser.win, store: app.store, run: app.run, languages: ['ru', 'en'] });
    app.run('locale.set', { lang: 'ru' });
    app.run('lesson.open', { id: 'B1' });
    expect(browser.entries).toEqual(['/en/lesson/I1', '/ru/lesson/I1', '/ru/lesson/B1']);
    browser.go(-1);
    expect(app.store.get().lesson).toBe('I1');
    expect(app.store.get().locale).toBe('ru');
    browser.go(-1);
    expect(app.store.get().locale).toBe('en');
  });
});

// M3.9: the page «About» (`/<lang>/about`). The lesson stays in the state behind it, so «back to
// the lessons» returns to the same place; `/` still opens the default lesson (K7).
describe('the about page', () => {
  function about(start: string) {
    const browser = fakeWindow(start);
    const app = fakeApp();
    const router = startRouter({
      window: browser.win,
      store: app.store,
      run: app.run,
      languages: ['ru', 'en'],
    });
    return { browser, app, router };
  }

  it('opens without touching the lesson, in the language of the address', () => {
    const { app, browser, router } = about('/EN/About/');
    expect(router.about.get()).toBe(true);
    expect(router.notFound.get()).toBe(false);
    expect(app.calls).toEqual(['locale.set {"lang":"en"}']);
    expect(browser.address()).toBe('/en/about');
    expect(browser.entries).toHaveLength(1);
  });

  it('the home page still opens the default lesson, not the about page', () => {
    const { browser, router } = about('/');
    expect(router.about.get()).toBe(false);
    expect(browser.address()).toBe('/ru/lesson/I1');
  });

  it('a step or mode change behind the page does not write the address', () => {
    const { app, browser } = about('/ru/about');
    app.run('player.goto', { step: 2 });
    app.run('defence.set', { on: true });
    expect(browser.entries).toEqual(['/ru/about']);
  });

  it('a language switch stays on the page and is a history entry', () => {
    const { app, browser, router } = about('/ru/about');
    app.run('locale.set', { lang: 'en' });
    expect(browser.entries).toEqual(['/ru/about', '/en/about']);
    browser.go(-1);
    expect(app.store.get().locale).toBe('ru');
    expect(router.about.get()).toBe(true);
  });

  it('opening another lesson leaves the page', () => {
    const { app, browser, router } = about('/ru/about');
    app.run('lesson.open', { id: 'B1' });
    expect(router.about.get()).toBe(false);
    expect(browser.entries).toEqual(['/ru/about', '/ru/lesson/B1']);
  });

  it('navigate: to the page and back to the same place in the lesson', () => {
    const { app, browser, router } = about('/ru/lesson/B1#step-3');
    router.navigate('/ru/about');
    expect(router.about.get()).toBe(true);
    expect(app.store.get().lesson).toBe('B1');
    expect(browser.entries).toEqual(['/ru/lesson/B1#step-3', '/ru/about']);
    router.navigate('/ru/lesson/B1#step-3');
    expect(router.about.get()).toBe(false);
    expect(app.store.get().player.step).toBe(3);
    expect(browser.address()).toBe('/ru/lesson/B1#step-3');
    browser.go(-1);
    expect(router.about.get()).toBe(true);
    browser.go(-1);
    expect(router.about.get()).toBe(false);
  });

  it('navigate ignores what is not a path of this site (L0.2)', () => {
    const { browser, router } = about('/ru/lesson/I1');
    for (const bad of [
      'https://example.com/',
      '//example.com/ru/about',
      'ru/about',
      '',
      42,
      null,
    ]) {
      router.navigate(bad);
    }
    router.navigate(`/ru/${'x'.repeat(100)}`);
    expect(browser.entries).toEqual(['/ru/lesson/I1']);
    expect(router.notFound.get()).toBe(false);
  });

  it('leaving «no such page» for the about page clears the message', () => {
    const { router } = about('/ru/nope');
    expect(router.notFound.get()).toBe(true);
    router.navigate('/ru/about');
    expect(router.notFound.get()).toBe(false);
    expect(router.about.get()).toBe(true);
  });
});
