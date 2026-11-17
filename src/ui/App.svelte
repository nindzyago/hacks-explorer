<script lang="ts">
  import type { AppContext } from '../commands/app';
  import { PROJECT } from '../core/project';
  import ClockReadout from './ClockReadout.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  const { app }: { app: AppContext } = $props();
  // A development aid, like the control channel: the dev server and the e2e build only.
  const showClock = import.meta.env.DEV || import.meta.env.MODE === 'e2e';
</script>

<main data-testid="app">
  <h1>{PROJECT.name}</h1>
  <p>{PROJECT.tagline.ru}</p>
  <ThemeToggle {app} />
  {#if showClock}
    <ClockReadout clock={app.clock} />
  {/if}
</main>

<style>
  main {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }
</style>
