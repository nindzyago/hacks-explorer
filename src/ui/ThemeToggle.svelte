<script lang="ts">
  import type { AppContext } from '../commands/app';

  const { app }: { app: AppContext } = $props();
  const store = $derived(app.store);
  const dark = $derived($store.theme === 'dark');

  // The theme is an attribute of the page root. Colours will come from tokens (M1.2, M2.6);
  // until then the browser's own light and dark colours show the change.
  $effect(() => {
    document.documentElement.dataset.theme = $store.theme;
  });

  function toggle() {
    app.registry.run('theme.set', { theme: dark ? 'light' : 'dark' });
  }
</script>

<button type="button" data-testid="theme-toggle" aria-pressed={dark} onclick={toggle}>
  Тёмная тема
</button>

<style>
  :global(:root) {
    color-scheme: light;
  }

  :global(:root[data-theme='dark']) {
    color-scheme: dark;
  }
</style>
