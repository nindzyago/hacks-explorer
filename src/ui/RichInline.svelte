<script lang="ts">
  // Inline text of a lesson (K37): text, inline code, bold, italic, line breaks. Drawn with
  // elements, never with {@html}: lesson text is data, and Svelte escapes every text node.
  import type { SiteInline } from '../core/lesson/site';
  import RichInline from './RichInline.svelte';

  const { nodes }: { nodes: readonly SiteInline[] } = $props();
</script>

{#each nodes as node, i (i)}{#if node.type === 'text'}{node.value}{:else if node.type === 'code'}<code
      >{node.value}</code
    >{:else if node.type === 'strong'}<strong><RichInline nodes={node.children} /></strong
    >{:else if node.type === 'emphasis'}<em><RichInline nodes={node.children} /></em>{:else}<br
    />{/if}{/each}

<style>
  code {
    font-family: var(--font-mono);
    font-size: 0.92em;
    padding: 0 var(--space-1);
    background: var(--code-paper);
    color: var(--code-ink);
    border-radius: var(--radius-sm);
    overflow-wrap: anywhere;
  }
</style>
