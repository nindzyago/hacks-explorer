<script lang="ts">
  import type { AppContext } from '../commands/app';
  import type { SiteLesson } from '../core/lesson/site';
  import { stepCount } from '../core/player/player';
  import { PROJECT } from '../core/project';
  import { currentStep, stepsInMode } from '../core/scene-layout/message';
  import Scene from '../scene/Scene.svelte';
  import type { LessonLoader } from '../services/catalog/catalog';
  import { LOAD_TIMEOUT_MS, withDeadline } from '../time/load-timer';
  import { keyCommand, keyTarget } from './keyboard';
  import DefenceToggle from './DefenceToggle.svelte';
  import EventFeed from './EventFeed.svelte';
  import { loadErrorText, type ShownErrorCode } from './load-error';
  import PlayerControls from './PlayerControls.svelte';
  import StepsTable from './StepsTable.svelte';

  const {
    app,
    loader,
    home = '/',
  }: { app: AppContext; loader: LessonLoader; home?: string } = $props();
  const store = $derived(app.store);
  const player = $derived($store.player);

  /** Buttons and keys run commands by id (K13), the same way the control channel does. */
  const run = (id: string, params?: Readonly<Record<string, unknown>>) => {
    app.registry.run(id, params);
  };

  // The theme stays an attribute of the page root (K43): no dark tokens and no button yet, the
  // `theme.set` command still sets it, so M2.6 adds a dark theme with tokens alone.
  $effect(() => {
    document.documentElement.dataset['theme'] = $store.theme;
  });

  // The lesson in the state (B1 until `lesson.open`; addresses are M2), in Russian.
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
    let current = true;
    shown = { state: 'loading', attempt };
    const lesson = loader
      .lesson(id, 'ru')
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

  const step = $derived(
    shown.state === 'ready' ? currentStep(shown.lesson.steps, player.defence, player.step) : null,
  );

  /** S6: Space, ← →, D. Keys are ignored while typing and with Ctrl, ⌘ or Alt. */
  function onkeydown(event: KeyboardEvent): void {
    if (shown.state !== 'ready' || event.defaultPrevented) return;
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
  function onkeyup(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.code !== 'Space') return;
    if (keyTarget(event.target).player === true) event.preventDefault();
  }
</script>

<svelte:window {onkeydown} {onkeyup} />

<main data-testid="app">
  <header class="top" data-testid="topbar">
    <h1 class="brand">{PROJECT.name}</h1>
    {#if shown.state === 'ready'}
      <h2 class="lesson-title" id="lesson-title" data-testid="lesson-title">
        {shown.lesson.title}
      </h2>
    {:else}
      <p class="tagline">{PROJECT.tagline.ru}</p>
    {/if}
  </header>

  {#if shown.state === 'loading'}
    <p class="status" data-testid="lesson-loading" role="status">Загружаем урок…</p>
  {:else if shown.state === 'error'}
    <div class="status error" data-testid="lesson-error" data-code={shown.code} role="alert">
      <p>Не удалось открыть урок.</p>
      <p data-testid="lesson-error-text">{loadErrorText(shown.code)}</p>
      <div class="actions">
        <button
          type="button"
          data-testid="lesson-error-retry"
          onclick={() => {
            attempt += 1;
          }}>Попробовать снова</button
        >
        <a href={home} data-testid="lesson-error-home">На главную</a>
      </div>
    </div>
  {:else}
    <div class="work" data-testid="lesson" aria-labelledby="lesson-title" role="region">
      <div class="scene-area">
        {#key shown.lesson}
          <Scene lesson={shown.lesson} scene={player} clock={app.clock} />
        {/key}
      </div>

      <!-- The controls bar (K76): the player, then the «Без защиты / С защитой» toggle. -->
      <div class="controls-area">
        <div class="player-area"><PlayerControls {player} {run} /></div>
        <DefenceToggle {player} defenceName={shown.lesson.passport.defence} {run} />
      </div>

      <!-- M1.4 fills this panel: the step at three depths and the lesson passport. -->
      <section class="panel explain" data-testid="explain" aria-labelledby="explain-title">
        <h2 id="explain-title">Объяснение</h2>
        {#if step !== null}
          <p class="explain-step" data-testid="explain-step">
            Шаг {step.number} из {step.count}. {step.step.title}
          </p>
          <p class="muted">{step.step.result}</p>
        {:else}
          <p class="muted">В этом режиме у урока нет шагов.</p>
        {/if}
      </section>

      <section class="panel log" data-testid="log" aria-labelledby="log-title">
        <h2 id="log-title">Ход атаки</h2>
        {#if stepCount(player) > 0}
          <StepsTable lesson={shown.lesson} {player} {run} />
        {/if}
        <!-- The event feed (M1.5, K75): one line per started step, under the table. -->
        {#if stepCount(player) > 0}
          <EventFeed lesson={shown.lesson} {player} clock={app.clock} />
        {/if}
      </section>
    </div>
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

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
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
    flex: 1 1 32rem;
    min-width: 0;
  }

  .explain {
    grid-area: explain;
  }

  .log {
    grid-area: log;
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

  .explain-step {
    margin: 0;
    font-weight: 700;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
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
