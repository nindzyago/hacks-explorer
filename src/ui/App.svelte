<script lang="ts">
  import type { AppContext } from '../commands/app';
  import { PROJECT } from '../core/project';
  import ThemeToggle from './ThemeToggle.svelte';

  const { app }: { app: AppContext } = $props();
</script>

<main data-testid="app">
  <h1>{PROJECT.name}</h1>
  <p>{PROJECT.tagline.ru}</p>
  <ThemeToggle {app} />
</main>

<style>
  main {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }
</style>
