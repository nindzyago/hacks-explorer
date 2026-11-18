<script lang="ts">
  // The event feed (M1.5, K75): one line per started step of the current mode, newest last —
  // derived from the player state and the player clock, never appended to, so `player.back`
  // shows exactly the feed it had (S1). Each line: the number, who → whom: what, and a mark —
  // a sign and a word, coloured from the tokens, red only for a harmful message.
  import { MediaQuery } from 'svelte/reactivity';
  import type { Clock } from '../core/clock';
  import { feedLines, stepArrived, type FeedMark } from '../core/feed/feed';
  import type { SiteLesson } from '../core/lesson/site';
  import { elapsedMs, type PlayerState } from '../core/player/player';
  import { currentStep } from '../core/scene-layout/message';
  import ShieldMark from './ShieldMark.svelte';

  const {
    lesson,
    player,
    clock,
  }: {
    lesson: SiteLesson;
    player: PlayerState;
    clock: Pick<Clock, 'now' | 'subscribe'>;
  } = $props();

  let timeMs = $state(0);
  $effect(() => {
    timeMs = clock.now();
    return clock.subscribe((event) => {
      timeMs = event.timeMs;
    });
  });
  // S11: with reduced motion the message is at its target at once — on the scene and here.
  const reduced = new MediaQuery('prefers-reduced-motion: reduce', false);

  const current = $derived(currentStep(lesson.steps, player.defence, player.step));
  const arrived = $derived(
    current !== null && stepArrived(current.step, elapsedMs(player, timeMs), reduced.current),
  );
  const lines = $derived(feedLines(lesson, player, arrived));
  const SIGN: Readonly<Record<Exclude<FeedMark, 'stopped'>, string>> = {
    attack: '!',
    safe: '✓',
    legit: '•',
    moving: '…',
  };
</script>

{#if lines.length > 0}
  <section class="feed" data-testid="feed" aria-labelledby="feed-title">
    <h3 id="feed-title">Лента событий</h3>
    <ol>
      {#each lines as line (line.number)}
        <li
          data-testid="feed-line-{line.number}"
          data-step={line.id}
          data-mark={line.mark}
          class:now={line.current}
          aria-current={line.current ? 'step' : undefined}
        >
          <span class="num" data-testid="feed-number">{line.number}</span>
          <span class="text">{line.text}</span>
          <span class="mark {line.mark}" data-testid="feed-mark"
            >{#if line.mark === 'stopped'}<ShieldMark />{:else}<span aria-hidden="true"
                >{SIGN[line.mark]}</span
              >{/if}{line.word}</span
          >
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .feed {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  h3 {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
  }

  li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--line-width) solid var(--line);
    min-width: 0;
  }

  li.now {
    background: var(--paper);
  }

  .num {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--muted);
  }

  .text {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .mark {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1);
    font-weight: 700;
    white-space: nowrap;
    color: var(--muted);
  }

  .mark.attack {
    color: var(--scene-message-attack);
  }

  .mark.safe,
  .mark.stopped {
    color: var(--scene-message-safe);
  }

  .mark.legit {
    color: var(--scene-message-legit);
  }

  /* Phone (S10): the mark goes under the text, so a long message keeps its width. */
  @media (max-width: 760px) {
    li {
      grid-template-columns: 2rem minmax(0, 1fr);
    }

    .mark {
      grid-column: 2;
    }
  }
</style>
