<script lang="ts">
  // Inline text of a lesson (K37): text, inline code, bold, italic, line breaks, and glossary
  // terms (M2.4) the build found. Drawn with elements, never with {@html}: lesson text is data,
  // and Svelte escapes every text node.
  //
  // A term is a `span` with the role of a button rather than a `<button>`: it must wrap across
  // lines like the words around it («параметризованного запроса»). Enter and Space press it.
  import type { SiteInline } from '../core/lesson/site';
  import RichInline from './RichInline.svelte';
  import { openTerm } from './terms';

  const { nodes }: { nodes: readonly SiteInline[] } = $props();

  function onkeydown(event: KeyboardEvent, id: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    event.preventDefault();
    openTerm(id, event.currentTarget instanceof Element ? event.currentTarget : null);
  }
</script>

{#each nodes as node, i (i)}{#if node.type === 'text'}{node.value}{:else if node.type === 'code'}<code
      >{node.value}</code
    >{:else if node.type === 'strong'}<strong><RichInline nodes={node.children} /></strong
    >{:else if node.type === 'emphasis'}<em><RichInline nodes={node.children} /></em
    >{:else if node.type === 'term'}<span
      class="term"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      data-testid="term"
      data-term={node.id}
      onclick={(event) => {
        openTerm(node.id, event.currentTarget);
      }}
      onkeydown={(event) => {
        onkeydown(event, node.id);
      }}><span class="term-text"><RichInline nodes={node.children} /></span></span
    >{:else}<br />{/if}{/each}

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

  /* A word with a definition: a dotted underline, the colour of the text (K7). */
  .term {
    position: relative;
    cursor: pointer;
    text-decoration: underline dotted var(--legit);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  .term:hover {
    text-decoration-style: solid;
  }

  /*
   * On a phone the finger gets a target at least 44 px tall (S10) without moving the lines. The
   * enlarged areas of words on neighbouring lines overlap; the word's own letters stay above
   * every enlarged area (z-index inside the text's own stacking context, RichBlocks), so a tap
   * on a word opens that word, and a tap between lines opens the nearest word there.
   */
  .term-text {
    position: relative;
    z-index: 1;
  }

  @media (pointer: coarse), (max-width: 760px) {
    .term::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 44px;
      margin-top: -22px;
    }
  }
</style>
