<script lang="ts">
  import { PROJECT } from '../core/project';
</script>

<main data-testid="app">
  <h1>{PROJECT.name}</h1>
  <p>{PROJECT.tagline.ru}</p>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }
</style>
