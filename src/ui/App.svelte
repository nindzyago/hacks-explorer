<script lang="ts">
  import type { AppContext } from '../commands/app';
  import type { SiteLesson } from '../core/lesson/site';
  import { PROJECT } from '../core/project';
  import Scene from '../scene/Scene.svelte';
  import type { LessonLoader } from '../services/catalog/catalog';
  import { LOAD_TIMEOUT_MS, withDeadline } from '../time/load-timer';
  import { loadErrorText, type ShownErrorCode } from './load-error';

  const {
    app,
    loader,
    home = '/',
  }: { app: AppContext; loader: LessonLoader; home?: string } = $props();
  const store = $derived(app.store);

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
</script>

<main data-testid="app">
  <header>
    <h1>{PROJECT.name}</h1>
    <p class="tagline">{PROJECT.tagline.ru}</p>
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
    <section class="lesson" aria-labelledby="lesson-title">
      <h2 id="lesson-title">{shown.lesson.title}</h2>
      {#key shown.lesson}
        <Scene lesson={shown.lesson} scene={$store.scene} clock={app.clock} />
      {/key}
    </section>
  {/if}
</main>

<style>
  main {
    box-sizing: border-box;
    max-width: 60rem;
    margin: 0 auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* A phone (S10, M1.2c): 12 px at the sides leave the scene 8 px more for its columns. */
  @media (max-width: 480px) {
    main {
      padding: var(--space-3);
    }
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
  }

  h1 {
    margin: 0;
    font-size: var(--text-lg);
    letter-spacing: 0.04em;
  }

  .tagline {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .lesson {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--text-xl);
    line-height: 1.2;
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

  button {
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
