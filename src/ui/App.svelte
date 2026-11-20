<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import type { AppContext } from '../commands/app';
  import type { SiteLesson } from '../core/lesson/site';
  import { stepCount } from '../core/player/player';
  import { lessonDescription, pageTitle } from '../core/meta/meta';
  import { PROJECT } from '../core/project';
  import { createStore, type Store } from '../core/store';
  import { currentStep, stepsInMode } from '../core/scene-layout/message';
  import { MAX_QUERY_LENGTH } from '../core/topics/search';
  import type { SiteTopicSection } from '../core/topics/site';
  import Scene from '../scene/Scene.svelte';
  import Sequence from '../scene/Sequence.svelte';
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
  import type LessonsSidePanel from './LessonsSide.svelte';
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

  /*
   * M6.1 (design §2, §4): from 1280 px the lessons panel is a column of the screen, always open;
   * below it is the side panel behind «☰ Уроки» (M2.1b). A phone (≤ 760 px) has one column with
   * the player right under the scene.
   */
  const wide = new MediaQuery('min-width: 1280px', false);
  const phone = new MediaQuery('max-width: 760px', false);

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

  // M6.1: the lessons column of a wide screen is its own chunk too, with the topics of the page's
  // language; both load once the window is wide enough to show it.
  const showSide = $derived(wide.current && !$notFound && !$about);
  let Side = $state.raw<typeof LessonsSidePanel | null>(null);
  $effect(() => {
    if (!showSide || Side !== null) return;
    void import('./LessonsSide.svelte').then(
      (module) => {
        Side = module.default;
      },
      () => {
        // Without the chunk the column stays an empty frame; «☰ Уроки» is not needed to read.
      },
    );
  });
  type TopicsState =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly sections: readonly SiteTopicSection[] }
    | { readonly state: 'error' };
  let catalog = $state.raw<TopicsState>({ state: 'loading' });
  $effect(() => {
    if (!showSide) return;
    const lang = locale;
    let live = true;
    void topics.topics(lang).then(
      (result) => {
        if (live)
          catalog = result.ok
            ? { state: 'ready', sections: result.value.sections }
            : { state: 'error' };
      },
      () => {
        if (live) catalog = { state: 'error' };
      },
    );
    return () => {
      live = false;
    };
  });
  const sections = $derived(catalog.state === 'ready' ? catalog.sections : []);
  /** The search and the section chips of the top bar filter the lessons column. */
  let lessonQuery = $state('');
  let lessonSection = $state('');
  let sideTab = $state<'lessons' | 'glossary'>('lessons');
  const lessonSectionId = $derived(shown.state === 'ready' ? shown.lesson.section : '');
  /** A glossary word shows in the column while its glossary tab is open, not in place. */
  const sideGlossary = $derived(showSide && Side !== null && sideTab === 'glossary');

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
  /**
   * M6.2: the view tabs, as tabs move (WAI-ARIA): ← → and Home / End choose the other view and
   * take the focus to its tab; the player does not get these keys.
   */
  function onViewKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const keys: Readonly<Record<string, 'scene' | 'sequence'>> = {
      ArrowLeft: 'scene',
      Home: 'scene',
      ArrowRight: 'sequence',
      End: 'sequence',
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    run('view.set', { view: next });
    document.getElementById(`view-tab-${next}`)?.focus();
  }

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

{#snippet player_controls()}
  <PlayerControls {player} {run} {t} />
{/snippet}

<main data-testid="app" class:page={$about} class:wide={showSide}>
  <header class="top" data-testid="topbar">
    <div class="brand-box">
      <svg class="logo" viewBox="0 0 30 30" aria-hidden="true">
        <path d="M15 3 26 9v12L15 27 4 21V9z" />
        <path d="M4 9l11 6 11-6M15 15v12" />
      </svg>
      <div class="brand-text">
        <h1 class="brand">{PROJECT.name}</h1>
        <p class="tagline">{t('app.tagline')}</p>
      </div>
    </div>
    <!-- M6.1: the sections A–L filter the lessons column; the section of the open lesson is
         marked, the chosen one filled. Pressing it again shows every section. -->
    {#if showSide && sections.length > 0}
      <div class="sections">
        <span class="sections-label bp-caps" aria-hidden="true">{t('screen.sections')}</span>
        <div class="chips" role="group" aria-label={t('screen.sections')} data-testid="sections">
          {#each sections as s (s.id)}
            <button
              type="button"
              class="bp-chip"
              class:here={s.id === lessonSectionId}
              aria-pressed={lessonSection === s.id}
              aria-label={t('screen.section', { id: s.id, title: s.title })}
              title={t('screen.section', { id: s.id, title: s.title })}
              data-testid="section-{s.id}"
              onclick={() => {
                lessonSection = lessonSection === s.id ? '' : s.id;
                sideTab = 'lessons';
              }}>{s.id}</button
            >
          {/each}
        </div>
      </div>
    {/if}
    <!-- CI5: with the search the free space goes to it (up to its width) and then to its left
         margin; without it a spacer pushes the buttons to the right. -->
    {#if showSide}
      <label class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15 L20 20" /></svg
        >
        <span class="visually-hidden">{t('screen.search')}</span>
        <input
          type="search"
          autocomplete="off"
          spellcheck="false"
          maxlength={MAX_QUERY_LENGTH}
          placeholder={t('screen.search')}
          data-testid="lesson-search"
          bind:value={lessonQuery}
          oninput={() => {
            sideTab = 'lessons';
          }}
        />
      </label>
    {:else}
      <div class="spacer"></div>
    {/if}
    <!-- M3.9: «О проекте» / «К урокам». -->
    {#if $about}
      <a
        class="bp-btn nav"
        href="{base}{lessonPath}"
        data-testid="nav-lessons"
        onclick={(event) => {
          follow(event, lessonPath);
        }}>{t('nav.lessons')}</a
      >
    {:else}
      <a
        class="bp-btn nav"
        href="{base}{aboutPath}"
        data-testid="nav-about"
        onclick={(event) => {
          follow(event, aboutPath);
        }}>{t('nav.about')}</a
      >
    {/if}
    <!-- M2.1b: «☰ Уроки» opens the side panel with the lessons and the glossary; on a wide
         lesson screen the lessons are a column of their own and the button is not there. -->
    {#if !showSide}
      <button
        type="button"
        class="bp-btn menu"
        data-testid="open-lessons"
        aria-haspopup="dialog"
        aria-expanded={$store.drawer !== null}
        bind:this={lessonsButton}
        onclick={() => {
          run('drawer.open', { tab: 'lessons' });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
        {t('drawer.lessons')}
      </button>
    {/if}
    <!-- M2.3: the language switch, only when the site has more than one language. -->
    {#if locales.languages.length > 1}
      <div class="languages" role="group" aria-label={t('app.language')} data-testid="languages">
        {#each locales.languages as language (language.code)}
          <button
            type="button"
            class="bp-btn"
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
  {:else}
    <div class="screen" class:with-side={showSide}>
      {#if showSide}
        <div class="side-area">
          {#if Side !== null}
            <Side
              {sections}
              status={catalog.state}
              lesson={shown.state === 'ready' ? shown.lesson : null}
              current={lessonId}
              step={player.step}
              defence={player.defence}
              language={locale}
              {glossary}
              term={$store.glossary}
              {home}
              {t}
              {run}
              query={lessonQuery}
              section={lessonSection}
              bind:tab={sideTab}
            />
          {:else}
            <div class="bp-panel side-frame" aria-hidden="true"></div>
          {/if}
        </div>
      {/if}
      {#if shown.state === 'loading'}
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
          <!-- The scene panel (M6.1): the view tabs and «Без защиты / С защитой» in its head, the
               scene on the millimetre grid, the legend at the bottom. -->
          <section class="bp-panel scene-panel" data-testid="scene-panel">
            <div class="bp-head scene-head">
              <!-- M6.2: «Схема / Последовательность», tabs that run `view.set` (K13); ← → and
                   Home / End move between them (roving tabindex). -->
              <div class="views" role="tablist" aria-label={t('screen.view')}>
                <button
                  type="button"
                  role="tab"
                  class="bp-btn"
                  id="view-tab-scene"
                  aria-selected={$store.view === 'scene'}
                  aria-controls="view-panel"
                  tabindex={$store.view === 'scene' ? 0 : -1}
                  data-testid="view-scene"
                  title={t('screen.scheme')}
                  onclick={() => {
                    run('view.set', { view: 'scene' });
                  }}
                  onkeydown={onViewKey}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"
                    ><path
                      d="M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z"
                    /></svg
                  >
                  <span class="tab-text">{t('screen.scheme')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  class="bp-btn"
                  id="view-tab-sequence"
                  aria-selected={$store.view === 'sequence'}
                  aria-controls="view-panel"
                  tabindex={$store.view === 'sequence' ? 0 : -1}
                  data-testid="view-sequence"
                  title={t('view.sequence')}
                  onclick={() => {
                    run('view.set', { view: 'sequence' });
                  }}
                  onkeydown={onViewKey}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"
                    ><path
                      d="M6 3 V21 M18 3 V21 M6 8 H16 M13 5 L16 8 L13 11 M18 15 H8 M11 12 L8 15 L11 18"
                    /></svg
                  >
                  <span class="tab-text">{t('view.sequence')}</span>
                </button>
              </div>
              <DefenceToggle {player} defenceName={shown.lesson.passport.defence} {run} {t} />
            </div>
            <div
              class="scene-body"
              role="tabpanel"
              id="view-panel"
              aria-labelledby="view-tab-{$store.view}"
            >
              <!-- M6.2: the scene or the sequence of the same lesson and player. -->
              {#key shown.lesson}
                {#if $store.view === 'sequence'}
                  <Sequence lesson={shown.lesson} {player} clock={app.clock} {run} {t} />
                {:else}
                  <div class="scene-fit">
                    <Scene lesson={shown.lesson} scene={player} clock={app.clock} {t} />
                  </div>
                {/if}
              {/key}
              <ul class="legend" aria-label={t('screen.legend')} data-testid="scene-legend">
                <li>
                  <span class="swatch path" aria-hidden="true"></span>{t('screen.legend.path')}
                </li>
                <li class="harmful">
                  <span class="swatch harm" aria-hidden="true"></span>{t('screen.legend.harmful')}
                </li>
                <li class="stopped">
                  <span class="swatch stop" aria-hidden="true"></span>{t('screen.legend.stopped')}
                </li>
                {#if $store.view === 'sequence'}
                  <li class="future" data-testid="legend-future">
                    <span class="swatch future" aria-hidden="true"></span>{t('sequence.future')}
                  </li>
                {/if}
              </ul>
            </div>
          </section>

          <!-- Phone (design §4): the player right under the scene. -->
          {#if phone.current}
            <div class="bp-panel controls-panel">{@render player_controls()}</div>
          {/if}

          <!-- M1.4: the step at three depths, the passport, «Как защититься», the sources. -->
          <div class="explain-area">
            <ExplainPanel lesson={shown.lesson} current={step} depth={$store.depth} {run} {t} />
          </div>

          <!-- «Ход атаки» with the event feed inside (M2.1a, D2, K91), the legend and the player
               in its head (M6.1): one area that scrolls by itself on a laptop, the page does not. -->
          <section class="bp-panel log" data-testid="log" aria-labelledby="log-title">
            <div class="bp-head log-head">
              <div class="log-title">
                <h2 class="bp-title" id="log-title">{t('log.title')}</h2>
                <ul class="marks" aria-label={t('screen.legend')}>
                  <li class="legit">{t('mark.legit')}</li>
                  <li class="attack">{t('mark.attack')}</li>
                  <li class="stopped">{t('mark.stopped')}</li>
                </ul>
              </div>
              {#if !phone.current}
                <div class="player-slot">{@render player_controls()}</div>
              {/if}
            </div>
            {#if stepCount(player) > 0}
              <StepsTable lesson={shown.lesson} {player} clock={app.clock} {run} {t} />
            {/if}
          </section>
        </div>
        <!-- M2.4: the definition of a glossary term, opened from the text or the scene. While the
             side panel or the glossary tab of the lessons column is open a term shows there. -->
        {#if $store.drawer === null && !sideGlossary}
          <GlossaryPopover {app} loader={glossary} language={shown.lesson.language} {t} />
        {/if}
      {/if}
    </div>
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
    margin: 0 auto;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* ---------------------------------------------------------------- top bar (M6.1, §2) */

  /* CI5: the bar never shrinks below its content in the one-screen column (it used to squeeze
     to 36 px and let a wrapped row slide under the lessons column); it grows instead. */
  .top {
    flex: none;
    min-height: var(--target);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .brand-box {
    box-sizing: border-box;
    min-height: var(--target);
    padding: var(--space-1) var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    border: var(--frame-width) solid var(--frame);
    border-radius: var(--radius-sm);
    min-width: 0;
  }

  .logo {
    flex: none;
    width: 30px;
    height: 30px;
  }

  .logo path,
  .search path,
  .search circle,
  .menu path,
  .views path {
    fill: none;
    stroke: currentcolor;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .logo {
    color: var(--legit);
  }

  .brand-text {
    min-width: 0;
  }

  .brand {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.1875rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--legit);
    white-space: nowrap;
  }

  .tagline {
    margin: 0;
    max-width: 22rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.25;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sections-label {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--legit);
  }

  .chips {
    display: flex;
    gap: 3px;
  }

  .chips .bp-chip {
    padding: 0;
  }

  /* The section of the open lesson, when no section is chosen: a blue frame. */
  .chips .here {
    border-color: var(--legit);
    font-weight: 700;
  }

  .spacer {
    flex: 1 1 0;
  }

  /* CI5: a row of the bar is broken by the flex basis, not by min-width. With a 16rem basis the
     bar at 1280 px had 2 px to spare on macOS and wrapped on Linux, whose same fonts draw a little
     wider. The search now starts at its minimum and grows into the free space, up to 16rem. */
  .search {
    box-sizing: border-box;
    flex: 1 1 9rem;
    min-width: 9rem;
    max-width: 16rem;
    margin-left: auto;
    min-height: var(--target);
    padding: 0 var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: var(--frame-width) solid var(--line);
    border-radius: var(--radius-xs);
    color: var(--muted);
  }

  .search:focus-within {
    border-color: var(--legit);
  }

  .search svg,
  .menu svg,
  .views svg {
    flex: none;
    width: 16px;
    height: 16px;
  }

  .search input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
  }

  .languages {
    display: flex;
  }

  .languages .bp-btn {
    min-width: 44px;
    border-radius: 0;
  }

  .languages .bp-btn:first-child {
    border-radius: var(--radius-xs) 0 0 var(--radius-xs);
  }

  .languages .bp-btn:last-child {
    border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  }

  .languages .bp-btn + .bp-btn {
    border-left: 0;
  }

  /* ---------------------------------------------------------------- the lesson screen */

  .screen {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .side-frame {
    height: 100%;
  }

  .work {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    min-width: 0;
  }

  .scene-head {
    justify-content: space-between;
  }

  .views {
    display: flex;
    gap: var(--space-1);
  }

  /*
   * M6.2: from 761 to 1439 px the scene panel is too narrow for both tab names and the defence
   * switch on one line: the tabs show their icons, the names stay for screen readers and in the
   * tooltip.
   */
  @media (min-width: 761px) and (max-width: 1439px) {
    .views .tab-text {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  .scene-body {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--scene-paper);
    background-image:
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
    background-size: var(--grid-step) var(--grid-step);
  }

  .scene-fit {
    min-width: 0;
  }

  .legend {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .legend li,
  .marks li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .legend .harmful,
  .marks .attack {
    color: var(--attack);
  }

  .legend .stopped,
  .marks .stopped {
    color: var(--defence);
  }

  .swatch {
    flex: none;
    width: 20px;
    height: 0;
    border-top: 2px dashed var(--zone-line);
  }

  .swatch.harm {
    border-top: 3px solid var(--attack);
  }

  /* M6.2: a step yet to come in the sequence view. */
  .swatch.future {
    border-top: 2px dashed var(--muted);
  }

  .swatch.stop {
    width: 8px;
    height: 8px;
    border: 0;
    background: var(--defence);
    transform: rotate(45deg);
  }

  .controls-panel :global(.controls) {
    border: 0;
  }

  .explain-area {
    min-width: 0;
  }

  .log-head {
    justify-content: space-between;
  }

  .log-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-4);
  }

  .marks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .marks li::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentcolor;
  }

  .marks .legit {
    color: var(--legit);
  }

  .player-slot {
    min-width: 0;
  }

  /*
   * One screen (M2.1a, E1, K93; M6.1 design §2): from 761 px the page is as tall as the window
   * (100dvh). The scene and the explanation share the top row, «Ход атаки» with the player takes
   * the bottom one; from 1280 px the lessons column stands on the left through both rows.
   * Panels scroll inside; the page does not.
   */
  @media (min-width: 761px) {
    main:not(.page) {
      height: 100dvh;
    }

    .screen {
      flex: 1 1 auto;
      min-height: 0;
    }

    .screen.with-side {
      display: grid;
      grid-template-columns: var(--col-lessons) minmax(0, 1fr);
      gap: var(--space-3);
    }

    .side-area {
      min-height: 0;
    }

    .work {
      flex: 1 1 auto;
      min-height: 0;
      grid-template-columns: minmax(0, 1fr) var(--col-explain);
      grid-template-rows: minmax(0, 1fr) var(--row-log);
      grid-template-areas:
        'scene explain'
        'log log';
    }

    .scene-panel {
      grid-area: scene;
    }

    .scene-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .scene-fit {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .explain-area {
      grid-area: explain;
      min-height: 0;
    }

    .log {
      grid-area: log;
    }
  }

  /* Phone (S10, design §4): one column — scene, player, explanation, «Ход атаки». */
  @media (max-width: 760px) {
    .top {
      gap: var(--space-2);
    }

    .brand-box {
      flex: 1 1 100%;
    }

    .brand {
      font-size: var(--text-md);
    }

    .nav {
      margin-left: auto;
    }

    .scene-head {
      justify-content: flex-start;
    }
  }

  .status {
    margin: 0;
    padding: var(--space-4);
    background: var(--panel);
    border: var(--frame-width) solid var(--frame);
    border-radius: var(--radius-sm);
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
    border: var(--frame-width) solid var(--legit);
    border-radius: var(--radius-xs);
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
