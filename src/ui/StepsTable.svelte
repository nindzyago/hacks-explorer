<script lang="ts">
  // «Ход атаки» (K7, M1.3) with the event feed inside (M2.1a, D2, K91): one row per step of the
  // current mode — number, title, from, to, what was sent, result, and the mark of what already
  // happened. Rows up to the current one have happened and carry the mark of the feed (K75: a
  // sign and a word, derived from the player state in src/core/feed); the current one is «в пути»
  // until its message arrives; later rows are dimmed and have no mark yet. The number is a button
  // that runs `player.goto` (K13). On a laptop the rows scroll inside their own area and the
  // current row is kept in view without moving the page; on a phone each row is a small card.
  import { MediaQuery } from 'svelte/reactivity';
  import type { Clock } from '../core/clock';
  import { feedLines, stepArrived, type FeedMark } from '../core/feed/feed';
  import { keepTogether } from '../core/feed/result';
  import type { SiteLesson } from '../core/lesson/site';
  import { elapsedMs, type PlayerState } from '../core/player/player';
  import { currentStep, stepsInMode } from '../core/scene-layout/message';
  import type { Translate } from '../services/i18n/i18n';
  import ShieldMark from './ShieldMark.svelte';

  const {
    lesson,
    player,
    clock,
    run,
    t,
  }: {
    lesson: SiteLesson;
    player: PlayerState;
    clock: Pick<Clock, 'now' | 'subscribe'>;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();

  const steps = $derived(stepsInMode(lesson.steps, player.defence));
  const names = $derived(new Map(lesson.participants.map((p) => [p.id, p.name])));
  const name = (id: string) => names.get(id) ?? id;

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
  const lines = $derived(feedLines(lesson, player, arrived, t));

  const SIGN: Readonly<Record<Exclude<FeedMark, 'stopped'>, string>> = {
    attack: '!',
    safe: '✓',
    legit: '•',
    moving: '…',
  };

  // The current row stays in view inside the area (never the page: no scrollIntoView, which
  // would scroll the page on a phone, and no smooth scroll). Under the sticky header, if needed.
  let area = $state<HTMLElement | null>(null);
  $effect(() => {
    const n = current?.number ?? 0;
    if (area === null || n === 0 || steps.length === 0) return;
    const row = area.querySelector<HTMLElement>(`tr[data-testid="step-row-${String(n)}"]`);
    if (row === null || area.scrollHeight <= area.clientHeight) return;
    const box = area.getBoundingClientRect();
    const head = area.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const r = row.getBoundingClientRect();
    if (r.top < box.top + head) area.scrollTop -= box.top + head - r.top;
    else if (r.bottom > box.bottom) area.scrollTop += r.bottom - box.bottom;
  });
</script>

<div class="steps-area" data-testid="steps-area" bind:this={area}>
  <!-- data-player-keys: Space here is play/pause (K69). -->
  <table data-testid="steps-table" data-defence={player.defence} data-player-keys>
    <thead>
      <tr>
        <th scope="col">{t('steps.number')}</th>
        <th scope="col">{t('steps.step')}</th>
        <th scope="col">{t('steps.from')}</th>
        <th scope="col">{t('steps.to')}</th>
        <th scope="col">{t('steps.sent')}</th>
        <th scope="col">{t('steps.result')}</th>
        <th scope="col">{t('steps.mark')}</th>
      </tr>
    </thead>
    <tbody>
      <!-- Rows are keyed by their number, not by the step id: after D the step with the same
         number is another step, but its button stays the same element and keeps the focus. -->
      {#each steps as step, i (i)}
        {@const n = i + 1}
        {@const paint = step.stopped ? 'stopped' : step.kind}
        {@const line = lines[i]}
        {@const mark = line?.mark ?? 'future'}
        <tr
          data-testid="step-row-{n}"
          data-step={step.id}
          data-mark={mark}
          class:now={n === player.step}
          class:future={n > player.step}
          aria-current={n === player.step ? 'step' : undefined}
        >
          <td class="num">
            <button
              type="button"
              class={paint}
              data-testid="step-goto-{n}"
              aria-label={t('steps.goto', { number: n, title: step.title })}
              aria-current={n === player.step ? 'step' : undefined}
              onclick={() => {
                run('player.goto', { step: n });
              }}>{n}</button
            >
          </td>
          <td class="title">{step.title}</td>
          <td class="who" data-label={t('steps.from')}>{name(step.from)}</td>
          <td class="who" data-label={t('steps.to')}
            >{step.from === step.to ? '—' : name(step.to)}</td
          >
          <td class="what" data-testid="step-payload">{keepTogether(step.message)}</td>
          <td class="result {paint}" data-testid="step-result">{step.result}</td>
          <td class="mark {mark}" data-testid="step-mark"
            >{#if line === undefined}<span class="none" aria-hidden="true">—</span><span class="sr"
                >{t('steps.notYet')}</span
              >{:else if line.mark === 'stopped'}<ShieldMark />{line.word}{:else}<span
                aria-hidden="true">{SIGN[line.mark]}</span
              >{line.word}{/if}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  /* Positioned: the hidden words of the rows stay inside the area, not below the page. */
  .steps-area {
    position: relative;
    min-width: 0;
  }

  /* A laptop (M2.1a, E1): the rows scroll inside the area, the header stays on top. */
  @media (min-width: 761px) {
    .steps-area {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--panel);
    }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  th {
    text-align: left;
    font-weight: 500;
    color: var(--muted);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--line-width) solid var(--line);
  }

  td {
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--line-width) solid var(--line);
    vertical-align: middle;
    /* M1.6: one long word in a title or result wraps instead of widening the page. */
    overflow-wrap: anywhere;
  }

  tr.now {
    background: var(--paper);
  }

  tr.now .title {
    font-weight: 700;
  }

  /* Later steps are dimmed with the muted ink, not with opacity: text keeps 4.5:1. */
  tr.future td:not(.num),
  tr.future .result {
    color: var(--muted);
  }

  .what {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  .num button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 50%;
    font: inherit;
    font-weight: 700;
    color: var(--scene-message-text);
    background: var(--scene-message-legit);
    cursor: pointer;
  }

  .num button.attack {
    background: var(--scene-message-attack);
  }

  .num button.safe,
  .num button.stopped {
    background: var(--scene-message-safe);
  }

  tr.future .num button {
    background: var(--muted);
  }

  .result.attack {
    color: var(--scene-message-attack);
  }

  .result.safe,
  .result.stopped {
    color: var(--scene-message-safe);
  }

  /* The mark of the feed (K75): a sign and a word; red only for harmful, green when stopped. */
  .mark {
    font-weight: 700;
    white-space: nowrap;
    overflow-wrap: normal;
    color: var(--muted);
  }

  .mark > :global(*) {
    margin-right: var(--space-1);
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

  .mark .none {
    font-weight: 400;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Phone (S10): a row is a card — number and title, then who → whom, what and the result. */
  @media (max-width: 760px) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    table,
    tbody,
    tr,
    td {
      display: block;
    }

    tr {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr);
      column-gap: var(--space-2);
      padding: var(--space-2) 0;
      border-bottom: var(--line-width) solid var(--line);
    }

    td {
      border: 0;
      padding: 0;
      min-width: 0;
    }

    .num {
      grid-row: span 5;
    }

    .title {
      grid-column: 2 / 4;
      align-self: center;
    }

    .who::before {
      content: attr(data-label) ': ';
      color: var(--muted);
    }

    .what,
    .result,
    .mark {
      grid-column: 2 / 4;
    }

    /* A future row has nothing to mark yet: no empty line in its card. */
    .mark:has(.none) {
      display: none;
    }
  }
</style>
