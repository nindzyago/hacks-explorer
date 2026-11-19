<script lang="ts">
  import type { AppContext } from '../commands/app';
  import type { SiteLesson } from '../core/lesson/site';
  import { stepCount } from '../core/player/player';
  import { lessonDescription, pageTitle } from '../core/meta/meta';
  import { PROJECT } from '../core/project';
  import { createStore, type Store } from '../core/store';
  import { currentStep, stepsInMode } from '../core/scene-layout/message';
  import Scene from '../scene/Scene.svelte';
  import type { LessonLoader } from '../services/catalog/catalog';
  import type { GlossaryLoader } from '../services/glossary/glossary';
  import type { TopicsLoader } from '../services/topics/topics';
  import { translator, type Locales } from '../services/i18n/i18n';
  import { LOAD_TIMEOUT_MS, withDeadline } from '../time/load-timer';
  import { formatAboutAddress, formatAddress } from '../services/router/address';
  import About from './About.svelte';
  import { keyCommand, keyTarget } from './keyboard';
  import DefenceToggle from './DefenceToggle.svelte';
  import type DrawerPanel from './Drawer.svelte';
  import GlossaryPopover from './GlossaryPopover.svelte';
  import ExplainPanel from './ExplainPanel.svelte';
  import { loadErrorKey, type ShownErrorCode } from './load-error';
  import PlayerControls from './PlayerControls.svelte';
  import StepsTable from './StepsTable.svelte';

  const {
    app,
    loader,
    glossary,
    topics,
    locales,
    home = '/',
    notFound = createStore(false),
    about = createStore(false),
    navigate = (path: string) => {
      window.location.assign(path);
    },
  }: {
    app: AppContext;
    loader: LessonLoader;
    glossary: GlossaryLoader;
    /** M2.1b: every topic of the site for the lessons panel (src/services/topics). */
    topics: TopicsLoader;
    /** M2.3: the site languages and their interface strings (src/services/i18n). */
    locales: Locales;
    home?: string;
    /** M2.2: the address is no page of the site (src/services/router). */
    notFound?: Pick<Store<boolean>, 'subscribe'>;
    /** M3.9: the address is the page «About» (src/services/router). */
    about?: Pick<Store<boolean>, 'subscribe'>;
    /** M3.9: opens a path of the site as a link would, without loading the page again. */
    navigate?: (path: string) => void;
  } = $props();
  const store = $derived(app.store);
  const player = $derived($store.player);
  // M2.3: the interface speaks the language of the page; `locale.set` changes it.
  const locale = $derived($store.locale);
  const t = $derived(
    translator(
      locales.strings[locale] ?? locales.strings[locales.languages[0]?.code ?? ''] ?? new Map(),
    ),
  );

  /** Buttons and keys run commands by id (K13), the same way the control channel does. */
  const run = (id: string, params?: Readonly<Record<string, unknown>>) => {
    app.registry.run(id, params);
  };

  // The theme stays an attribute of the page root (K43): no dark tokens and no button yet, the
  // `theme.set` command still sets it, so M2.6 adds a dark theme with tokens alone.
  $effect(() => {
    document.documentElement.dataset['theme'] = $store.theme;
  });
  $effect(() => {
    document.documentElement.lang = locale;
  });
  // The lesson in the state (I1 «Фишинг» until `lesson.open` or an address, K7), in the
  // language of the page (M2.3): a change of language loads the same lesson in the other one.
  type Shown =
    | { readonly state: 'loading'; readonly attempt: number }
    | { readonly state: 'ready'; readonly lesson: SiteLesson }
    | { readonly state: 'error'; readonly code: ShownErrorCode };
  let shown = $state<Shown>({ state: 'loading', attempt: 0 });
  /** Bumped by «Попробовать снова»: the effect below loads again. */
  let attempt = $state(0);
  const lessonId = $derived($store.lesson);

  $effect(() => {
    const id = lessonId;
    const language = locale;
    // M2.2: an address that is no page of the site loads no lesson behind its message.
    if ($notFound || $about) return;
    let current = true;
    shown = { state: 'loading', attempt };
    const lesson = loader
      .lesson(id, language)
      .then((result): Shown =>
        result.ok
          ? { state: 'ready', lesson: result.value }
          : { state: 'error', code: result.error.code },
      );
    const loaded = withDeadline(lesson, LOAD_TIMEOUT_MS, (): Shown => ({
      state: 'error',
      code: 'timeout',
    }));
    void loaded.then(
      (next) => {
        if (current) shown = next;
      },
      () => {
        if (current) shown = { state: 'error', code: 'network' };
      },
    );
    return () => {
      current = false;
    };
  });

  // The player learns how many steps the loaded lesson has in each mode (M1.3).
  $effect(() => {
    if (shown.state !== 'ready') return;
    const { id, steps } = shown.lesson;
    app.lessonLoaded(id, {
      without: stepsInMode(steps, false).length,
      with: stepsInMode(steps, true).length,
    });
  });

  // M2.2: the page title says when the address is no page; the heading takes the focus.
  // M4.3: a lesson page has the lesson's own title and description, the same as the static page
  // the build writes for it (scripts/site-pages.ts), so a search engine that runs scripts sees
  // them too; the site's own description stays for «no page» and a lesson that failed to load.
  // While a lesson loads the previous ones stay. The default in index.html is Russian (K109).
  let notFoundHeading = $state<HTMLElement | null>(null);
  $effect(() => {
    let title: string | null = null;
    let description: string | null = null;
    if ($notFound) {
      title = pageTitle(t('page.notFound.title'));
      description = t('app.description');
    } else if ($about) {
      title = pageTitle(t('about.title'));
      description = t('about.description');
    } else if (shown.state === 'ready') {
      title = pageTitle(shown.lesson.title);
      description = lessonDescription(shown.lesson.passport, t) ?? t('app.description');
    } else if (shown.state === 'error') {
      title = pageTitle(null);
      description = t('app.description');
    }
    if (title !== null) document.title = title;
    if (description !== null) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    }
  });
  $effect(() => {
    notFoundHeading?.focus();
  });

  const step = $derived(
    shown.state === 'ready' ? currentStep(shown.lesson.steps, player.defence, player.step) : null,
  );

  /** S6: Space, ← →, D. Keys are ignored while typing and with Ctrl, ⌘ or Alt. */
  function onkeydown(event: KeyboardEvent): void {
    // M2.1b: while the side panel is open the player takes no keys.
    if ($notFound || $about || shown.state !== 'ready' || event.defaultPrevented) return;
    if ($store.drawer !== null) return;
    const id = keyCommand(
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        target: keyTarget(event.target),
      },
      player.playing,
    );
    if (id === null) return;
    // Space and the arrows would scroll the page; Space on a player button would press it.
    event.preventDefault();
    run(id);
  }

  /** A button is pressed by Space on key up: on the player's own buttons Space was play/pause. */
  let lessonsButton = $state<HTMLButtonElement | null>(null);

  // M2.1b: the side panel is its own chunk, loaded the first time it opens (not in the first
  // load). If the chunk cannot load the panel's state is closed again, so the buttons still work.
  let Drawer = $state.raw<typeof DrawerPanel | null>(null);
  $effect(() => {
    if ($store.drawer === null || Drawer !== null) return;
    void import('./Drawer.svelte').then(
      (module) => {
        Drawer = module.default;
      },
      () => {
        run('drawer.close');
      },
    );
  });

  // M3.9: the way to the page «About» and back to the lesson where the reader was.
  const base = $derived(home.endsWith('/') ? home.slice(0, -1) : home);
  const aboutPath = $derived(formatAboutAddress(locale));
  const lessonPath = $derived(
    formatAddress({
      lang: locale,
      lesson: lessonId,
      step: player.step,
      defence: player.defence,
    }),
  );
  function follow(event: MouseEvent, path: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }

  function onkeyup(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.code !== 'Space') return;
    if (keyTarget(event.target).player === true) event.preventDefault();
  }
</script>

<svelte:window {onkeydown} {onkeyup} />

<main data-testid="app" class:page={$about}>
  <header class="top" data-testid="topbar">
    <h1 class="brand">{PROJECT.name}</h1>
    {#if shown.state === 'ready' && !$notFound && !$about}
      <h2 class="lesson-title" id="lesson-title" data-testid="lesson-title">
        {shown.lesson.title}
      </h2>
    {:else}
      <p class="tagline">{t('app.tagline')}</p>
    {/if}
    <!-- M3.9: «О проекте» / «К урокам» before the panel buttons; on a phone it stays on the first
         row with the title when there is room. -->
    {#if $about}
      <a
        class="nav"
        href="{base}{lessonPath}"
        data-testid="nav-lessons"
        onclick={(event) => {
          follow(event, lessonPath);
        }}>{t('nav.lessons')}</a
      >
    {:else}
      <a
        class="nav"
        href="{base}{aboutPath}"
        data-testid="nav-about"
        onclick={(event) => {
          follow(event, aboutPath);
        }}>{t('nav.about')}</a
      >
    {/if}
    <!-- M2.1b: the side panel with the lessons and the glossary (K102: 44 px). -->
    <div class="panels" data-testid="panel-buttons">
      <button
        type="button"
        data-testid="open-lessons"
        aria-haspopup="dialog"
        aria-expanded={$store.drawer === 'lessons'}
        bind:this={lessonsButton}
        onclick={() => {
          run('drawer.open', { tab: 'lessons' });
        }}>{t('drawer.lessons')}</button
      >
      <button
        type="button"
        data-testid="open-glossary"
        aria-haspopup="dialog"
        aria-expanded={$store.drawer === 'glossary'}
        onclick={() => {
          run('drawer.open', { tab: 'glossary' });
        }}>{t('drawer.glossary')}</button
      >
    </div>
    <!-- M2.3: the language switch, only when the site has more than one language. -->
    {#if locales.languages.length > 1}
      <div class="languages" role="group" aria-label={t('app.language')} data-testid="languages">
        {#each locales.languages as language (language.code)}
          <button
            type="button"
            lang={language.code}
            title={language.name}
            data-testid="language-{language.code}"
            aria-pressed={language.code === locale}
            onclick={() => {
              run('locale.set', { lang: language.code });
            }}>{language.code.toUpperCase()}</button
          >
        {/each}
      </div>
    {/if}
  </header>

  {#if $notFound}
    <div class="status error" data-testid="page-not-found" role="alert">
      <h2
        class="not-found-title"
        tabindex="-1"
        data-testid="not-found-title"
        bind:this={notFoundHeading}
      >
        {t('page.notFound.title')}
      </h2>
      <p>{t('page.notFound.text')}</p>
      <div class="actions">
        <a href={home} data-testid="not-found-home">{t('page.home')}</a>
      </div>
    </div>
  {:else if $about}
    <About loader={topics} language={locale} {home} {t} onopen={navigate} />
  {:else if shown.state === 'loading'}
    <p class="status" data-testid="lesson-loading" role="status">{t('lesson.loading')}</p>
  {:else if shown.state === 'error'}
    <div class="status error" data-testid="lesson-error" data-code={shown.code} role="alert">
      <p>{t('lesson.error.title')}</p>
      <p data-testid="lesson-error-text">{t(loadErrorKey(shown.code))}</p>
      <div class="actions">
        <button
          type="button"
          data-testid="lesson-error-retry"
          onclick={() => {
            attempt += 1;
          }}>{t('lesson.retry')}</button
        >
        <a href={home} data-testid="lesson-error-home">{t('page.home')}</a>
      </div>
    </div>
  {:else}
    <div class="work" data-testid="lesson" aria-labelledby="lesson-title" role="region">
      <div class="scene-area">
        {#key shown.lesson}
          <Scene lesson={shown.lesson} scene={player} clock={app.clock} {t} />
        {/key}
      </div>

      <!-- The controls bar (K76): the player, then the «Без защиты / С защитой» toggle. -->
      <div class="controls-area">
        <div class="player-area"><PlayerControls {player} {run} {t} /></div>
        <DefenceToggle {player} defenceName={shown.lesson.passport.defence} {run} {t} />
      </div>

      <!-- M1.4: the step at three depths, the passport, «Как защититься», the sources. -->
      <div class="explain-area">
        <ExplainPanel lesson={shown.lesson} current={step} depth={$store.depth} {run} {t} />
      </div>

      <!-- «Ход атаки» with the event feed inside (M2.1a, D2, K91): one area that scrolls by
           itself on a laptop, the page does not. -->
      <section class="panel log" data-testid="log" aria-labelledby="log-title">
        <h2 id="log-title">{t('log.title')}</h2>
        {#if stepCount(player) > 0}
          <StepsTable lesson={shown.lesson} {player} clock={app.clock} {run} {t} />
        {/if}
      </section>
    </div>
    <!-- M2.4: the definition of a glossary term, opened from the text or the scene. While the
         side panel is open a term shows in the panel instead (M2.1b). -->
    {#if $store.drawer === null}
      <GlossaryPopover {app} loader={glossary} language={shown.lesson.language} {t} />
    {/if}
  {/if}
  {#if Drawer !== null}
    <Drawer
      {app}
      {topics}
      {glossary}
      {home}
      {t}
      notFound={$notFound || $about}
      fallbackFocus={() => lessonsButton}
    />
  {/if}
</main>

<style>
  main {
    box-sizing: border-box;
    max-width: 90rem;
    margin: 0 auto;
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* K102: the height of the top bar is already that of the «Уроки» and «Словарь» buttons (M2.1b). */
  .top {
    min-height: 44px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }

  .brand {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  .top .lesson-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink);
  }

  .tagline {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  /* M2.1b: «Уроки» and «Словарь» before the language switch, at the end of the top bar. */
  .panels {
    display: flex;
    gap: var(--space-1);
  }

  .panels button {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: var(--line-width) solid var(--legit);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--legit);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  /* M3.9: «О проекте» / «К урокам», a plain link with a 44 px target before the panel buttons. */
  .nav {
    margin-left: auto;
    min-height: 44px;
    padding: 0 var(--space-2);
    display: inline-flex;
    align-items: center;
    color: var(--legit);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .panels button:hover {
    background: var(--paper);
  }

  /* M2.3: «RU / EN» at the end of the top bar, 44 px targets (K102). */
  .languages {
    display: flex;
    gap: var(--space-1);
  }

  .languages button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .languages button[aria-pressed='true'] {
    border-color: var(--legit);
    background: var(--legit);
    color: var(--panel);
  }

  /*
   * One screen (K7): the scene on the left, the explanation on the right, the «Ход атаки» table
   * with the player controls across the bottom.
   */
  .work {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22rem;
    grid-template-areas:
      'scene explain'
      'controls controls'
      'log log';
    gap: var(--space-3);
    min-width: 0;
  }

  .scene-area {
    grid-area: scene;
    min-width: 0;
  }

  .controls-area {
    grid-area: controls;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--space-3);
  }

  .player-area {
    flex: 1 1 30rem;
    min-width: 0;
    /* The player's bar takes the height of the row: as tall as the toggle next to it. */
    display: grid;
  }

  /*
   * K73: on a wide screen the scene sets the height of the top row and the explanation scrolls
   * inside it, so the controls stay right under the scene; on a phone it is a plain block.
   */
  .explain-area {
    grid-area: explain;
    min-width: 0;
    min-height: 18rem;
    position: relative;
  }

  .explain-area > :global(.explain) {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .log {
    grid-area: log;
  }

  /*
   * One screen (M2.1a, E1, K93): on a laptop the page is as tall as the window (100dvh); the
   * scene row and the controls take their own height, the «Ход атаки» area the rest and scrolls
   * inside it. When the window is too low for the smallest steps area the page grows and scrolls
   * rather than squeezing the rows. The phone keeps one column and the page scrolls (S10).
   */
  @media (min-width: 761px) {
    main:not(.page) {
      height: 100dvh;
    }

    .work {
      flex: 1 1 auto;
      min-height: 0;
      grid-template-rows: auto auto minmax(0, 1fr);
    }

    .log {
      min-height: 10rem;
    }
  }

  .panel {
    box-sizing: border-box;
    min-width: 0;
    padding: var(--space-3);
    background: var(--panel);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .panel h2 {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  /* Phone (S10): one column — scene, controls, explanation, then the table and the feed. */
  @media (max-width: 760px) {
    main {
      padding: var(--space-3);
    }

    .work {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'scene' 'controls' 'explain' 'log';
    }

    .explain-area {
      min-height: 0;
      position: static;
    }

    .explain-area > :global(.explain) {
      position: static;
      overflow-y: visible;
    }
  }

  .status {
    margin: 0;
    padding: var(--space-4);
    background: var(--panel);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
    color: var(--muted);
  }

  .error {
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .error p {
    margin: 0;
  }

  .not-found-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--ink);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .actions button {
    min-height: 44px;
    padding: 0 var(--space-4);
    border: var(--line-width) solid var(--legit);
    border-radius: var(--radius-md);
    background: var(--legit);
    color: var(--panel);
    font: inherit;
    cursor: pointer;
  }

  .error a {
    color: var(--legit);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
