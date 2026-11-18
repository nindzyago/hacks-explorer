<script lang="ts">
  // Block text of a lesson (K37): paragraphs, lists, code. Never {@html}.
  import type { SiteBlock } from '../core/lesson/site';
  import CodeBox from './CodeBox.svelte';
  import RichBlocks from './RichBlocks.svelte';
  import RichInline from './RichInline.svelte';

  const { blocks }: { blocks: readonly SiteBlock[] } = $props();
</script>

<div class="blocks">
  {#each blocks as block, i (i)}
    {#if block.type === 'paragraph'}
      <p><RichInline nodes={block.children} /></p>
    {:else if block.type === 'list'}
      <svelte:element this={block.ordered ? 'ol' : 'ul'}>
        {#each block.items as item, j (j)}
          <li><RichBlocks blocks={item} /></li>
        {/each}
      </svelte:element>
    {:else}
      <CodeBox code={block} />
    {/if}
  {/each}
</div>

<style>
  .blocks {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  ul,
  ol {
    margin: 0;
    padding-left: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
</style>
