<script lang="ts">
  // A piece of lesson code (K37): the harmful part, written ⟦…⟧ in the lesson, is a <mark>.
  // Long lines scroll inside the box, never the page (S10). Never {@html}.
  import type { SiteCode } from '../core/lesson/site';

  const {
    code,
    label = '',
    current = true,
  }: { code: SiteCode; label?: string; current?: boolean } = $props();
</script>

<figure class="code" data-testid="explain-code" data-current={current}>
  {#if label !== ''}
    <figcaption>{label}{current ? '' : ' — для сравнения'}</figcaption>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre
    tabindex="0"
    data-testid="explain-code-text"
    aria-label={label === '' ? 'Код шага' : `Код: ${label}`}><code
      >{#each code.segments as segment, i (i)}{#if segment.marked}<mark>{segment.text}</mark
          >{:else}{segment.text}{/if}{/each}</code
    ></pre>
</figure>

<style>
  .code {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  figcaption {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  pre {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    max-width: 100%;
    overflow-x: auto;
    background: var(--code-paper);
    color: var(--code-ink);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading);
  }

  mark {
    background: transparent;
    color: var(--code-mark);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
</style>
