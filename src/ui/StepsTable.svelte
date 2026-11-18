<script lang="ts">
  // «Ход атаки» (K7, M1.3): one row per step of the current mode — number, title, from, to, what
  // was sent, result. The current row is marked, later rows are dimmed (as the prototype). The
  // number is a button that runs `player.goto` (K13). On a phone each row is a small card.
  import type { SiteLesson } from '../core/lesson/site';
  import type { PlayerState } from '../core/player/player';
  import { stepsInMode } from '../core/scene-layout/message';
  import ShieldMark from './ShieldMark.svelte';

  const {
    lesson,
    player,
    run,
  }: {
    lesson: SiteLesson;
    player: PlayerState;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
  } = $props();

  const steps = $derived(stepsInMode(lesson.steps, player.defence));
  const names = $derived(new Map(lesson.participants.map((p) => [p.id, p.name])));
  const name = (id: string) => names.get(id) ?? id;
  const MARK = { legit: '', attack: '! ', safe: '✓ ' } as const;
  /** A stopped step (K44, K62): the shield, the word, then its result. */
  const STOPPED = 'остановлено: ';
</script>

<!-- data-player-keys: Space here is play/pause (K69). -->
<table data-testid="steps-table" data-defence={player.defence} data-player-keys>
  <thead>
    <tr>
      <th scope="col">№</th>
      <th scope="col">Шаг</th>
      <th scope="col">Кто</th>
      <th scope="col">Кому</th>
      <th scope="col">Что отправлено</th>
      <th scope="col">Итог</th>
    </tr>
  </thead>
  <tbody>
    <!-- Rows are keyed by their number, not by the step id: after D the step with the same
         number is another step, but its button stays the same element and keeps the focus. -->
    {#each steps as step, i (i)}
      {@const n = i + 1}
      {@const paint = step.stopped ? 'stopped' : step.kind}
      <tr
        data-testid="step-row-{n}"
        data-step={step.id}
        class:now={n === player.step}
        class:future={n > player.step}
        aria-current={n === player.step ? 'step' : undefined}
      >
        <td class="num">
          <button
            type="button"
            class={paint}
            data-testid="step-goto-{n}"
            aria-label="Шаг {n}: {step.title}"
            aria-current={n === player.step ? 'step' : undefined}
            onclick={() => {
              run('player.goto', { step: n });
            }}>{n}</button
          >
        </td>
        <td class="title">{step.title}</td>
        <td class="who" data-label="Кто">{name(step.from)}</td>
        <td class="who" data-label="Кому">{step.from === step.to ? '—' : name(step.to)}</td>
        <td class="what">{step.message}</td>
        <td class="result {paint}" data-testid="step-result"
          >{#if step.stopped}<span class="stopped-word"><ShieldMark /> {STOPPED}</span>{:else}{MARK[
              step.kind
            ]}{/if}{step.result}</td
        >
      </tr>
    {/each}
  </tbody>
</table>

<style>
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

  /* M1.5: a stopped step says so with the shield and the word (K44, K62), in green. */
  .stopped-word {
    font-weight: 700;
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
      grid-row: span 4;
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
    .result {
      grid-column: 2 / 4;
    }
  }
</style>
