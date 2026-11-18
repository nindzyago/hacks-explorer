<script lang="ts">
  import type { AppContext } from '../commands/app';
  import type { SiteLesson } from '../core/lesson/site';
  import { PROJECT } from '../core/project';
  import Scene from '../scene/Scene.svelte';
  import type { LessonLoader, LoadError } from '../services/catalog/catalog';
  import ClockReadout from './ClockReadout.svelte';

  const { app, loader }: { app: AppContext; loader: LessonLoader } = $props();
  // A development aid, like the control channel: the dev server and the e2e build only.
  // Stays until the scene depends on clock time (M1.2b); see K47 in the M1.2a report.
  const showClock = import.meta.env.DEV || import.meta.env.MODE === 'e2e';
  const store = $derived(app.store);

  // The theme stays an attribute of the page root (K43): no dark tokens and no button yet, the
  // `theme.set` command still sets it, so M2.6 adds a dark theme with tokens alone.
  $effect(() => {
    document.documentElement.dataset['theme'] = $store.theme;
  });

  // The one lesson of M1 (B1, Russian). Opening any lesson by address is M2 (router).
  type Shown =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly lesson: SiteLesson }
    | { readonly state: 'error'; readonly error: LoadError };
  let shown = $state<Shown>({ state: 'loading' });

  $effect(() => {
    let current = true;
    void loader.lesson('B1', 'ru').then((result) => {
      if (!current) return;
      shown = result.ok
        ? { state: 'ready', lesson: result.value }
        : { state: 'error', error: result.error };
    });
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
    <div class="status error" data-testid="lesson-error" role="alert">
      <p>Не удалось открыть урок. Попробуйте обновить страницу.</p>
      <p class="detail">{shown.error.message}</p>
      <a href="/" data-testid="lesson-error-home">На главную</a>
    </div>
  {:else}
    <section class="lesson" aria-labelledby="lesson-title">
      <h2 id="lesson-title">{shown.lesson.title}</h2>
      <Scene lesson={shown.lesson} />
    </section>
  {/if}

  {#if showClock}
    <ClockReadout clock={app.clock} />
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

  .detail {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  .error a {
    color: var(--legit);
  }
</style>
