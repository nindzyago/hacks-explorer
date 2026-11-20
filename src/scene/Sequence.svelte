<script lang="ts">
  // The sequence view of a lesson (M6.2, design M6 §5): lanes of the participants with dashed
  // lifelines, one row per step of the current course — a separator «Step N — title», the
  // message label and an arrow from sender to receiver (a note on the lane for a step to itself).
  // The current row is a highlighted band, rows yet to come are dashed and grey. It follows the
  // same player as the scene: the current arrow grows from the sender on the player clock (none
  // with reduced motion, S11), a click or Enter on a row runs `player.goto` (K13). Geometry comes
  // from src/core/sequence-layout, colours and fonts from tokens; no style= anywhere (CSP).
  import { MediaQuery, SvelteSet } from 'svelte/reactivity';
  import type { Clock } from '../core/clock';
  import type { SiteLesson } from '../core/lesson/site';
  import { elapsedMs, type PlayerState } from '../core/player/player';
  import { describeScene, describeStep } from '../core/scene-layout/describe';
  import { currentStep, travelProgress } from '../core/scene-layout/message';
  import {
    LABEL_PAD,
    SIGN_ROOM,
    layoutSequence,
    rowPaint,
    rowSign,
    type Row,
    type RowSign,
    type SequenceText,
  } from '../core/sequence-layout/layout';
  import type { Translate } from '../services/i18n/i18n';
  import { iconUrl } from './icons';

  const {
    lesson,
    player,
    clock,
    run,
    t,
  }: {
    lesson: SiteLesson;
    player: Pick<PlayerState, 'step' | 'defence' | 'startedMs' | 'speed'>;
    clock: Pick<Clock, 'now' | 'subscribe'>;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();
  const uid = $props.id();

  /** The width the rows are drawn for: the inner width of the scroll area. */
  let width = $state(760);
  let timeMs = $state(0);
  $effect(() => {
    timeMs = clock.now();
    return clock.subscribe((event) => {
      timeMs = event.timeMs;
    });
  });
  const reduced = new MediaQuery('prefers-reduced-motion: reduce', false);
  const failed = new SvelteSet<string>();

  const layout = $derived(
    layoutSequence(
      {
        participants: lesson.participants,
        steps: lesson.steps,
        defence: player.defence,
        step: player.step,
        width,
      },
      t,
    ),
  );
  const current = $derived(currentStep(lesson.steps, player.defence, player.step));
  const caption = $derived(describeStep(lesson.participants, current, t));
  const description = $derived(
    describeScene({ participants: lesson.participants, zones: lesson.zones }, t),
  );
  const progress = $derived(travelProgress(elapsedMs(player, timeMs), reduced.current));
  const icons = $derived(new Map(lesson.participants.map((p) => [p.id, iconUrl(p.icon)])));
  const round = (n: number) => Math.round(n * 10) / 10;

  /** How far the arrow of a row is drawn, 0…1: the current one moves, others are whole. */
  const reach = (row: Row) => (row.state === 'current' && row.shape === 'arrow' ? progress : 1);
  const arrived = (row: Row) => row.state === 'past' || reach(row) === 1;

  /** The row's accessible name: the step in words, the same sentence the scene says. */
  function rowName(row: Row): string {
    const count = layout.rows.length;
    const found = currentStep(lesson.steps, player.defence, row.number);
    return found === null ? '' : describeStep(lesson.participants, { ...found, count }, t);
  }

  function onRowKey(event: KeyboardEvent, n: number): void {
    // Space is play/pause here (data-player-keys, K69); Enter presses the row.
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    run('player.goto', { step: n });
  }

  // The current row stays in view inside the area on a laptop (never the page, no smooth scroll).
  let area = $state<HTMLElement | null>(null);
  $effect(() => {
    const row = layout.rows[layout.current - 1];
    if (area === null || row === undefined) return;
    if (area.scrollHeight <= area.clientHeight) return;
    const top = row.band.y;
    const bottom = row.band.y + row.band.height;
    if (top < area.scrollTop) area.scrollTop = top;
    else if (bottom > area.scrollTop + area.clientHeight) {
      area.scrollTop = bottom - area.clientHeight;
    }
  });

  const SIGNS: Readonly<Record<RowSign, string>> = {
    attack: 'M0 -3.4 V0.6 M0 2.7 V2.8',
    safe: 'M-3 0.2 L-0.9 2.3 L3 -2.1',
    right: 'M-3 0 H3 M0.8 -2.3 L3 0 L0.8 2.3',
    left: 'M3 0 H-3 M-0.8 -2.3 L-3 0 L-0.8 2.3',
    here: 'M0 0 V0.1',
    stopped: 'M0 -3.2 L2.6 -2.1 V0 C2.6 1.6 1.5 2.7 0 3.3 C-1.5 2.7 -2.6 1.6 -2.6 0 V-2.1 Z',
  };
</script>

{#snippet text(block: SequenceText, cls: string, part: string)}
  <!-- No space between lines: it would be drawn at the end of the line before and widen it.
       The text is hidden from screen readers; the row button says the step in words. -->
  <text class={cls} data-part={part} font-size={block.fontSize} aria-hidden="true"
    >{#each block.lines as line, i (i)}<tspan x={round(block.x)} y={round(line.y)}
        >{line.text}</tspan
      >{/each}{#if block.cut}<title>{block.full}</title>{/if}</text
  >
{/snippet}

<figure
  class="sequence"
  data-testid="sequence"
  data-lesson={lesson.id}
  data-defence={player.defence}
>
  <div class="area" data-testid="sequence-area" bind:this={area} bind:clientWidth={width}>
    <svg
      viewBox="0 0 {round(layout.width)} {round(layout.height)}"
      role="group"
      aria-labelledby="{uid}-title"
      aria-describedby="{uid}-desc"
      data-player-keys
    >
      <title id="{uid}-title">{t('sequence.title', { title: lesson.title })}</title>
      <desc id="{uid}-desc">{description}</desc>

      {#each layout.lanes as lane (lane.id)}
        {@const url = failed.has(lane.id) ? null : (icons.get(lane.id) ?? null)}
        <g class="lane" data-testid="sequence-lane-{lane.id}">
          <line
            class="lifeline"
            x1={round(lane.x)}
            x2={round(lane.x)}
            y1={round(layout.lifelineTop)}
            y2={round(layout.lifelineBottom)}
          />
          {#if url !== null}
            <image
              aria-hidden="true"
              data-part="icon"
              href={url}
              x={round(lane.iconBox.x)}
              y={round(lane.iconBox.y)}
              width={round(lane.iconBox.width)}
              height={round(lane.iconBox.height)}
              preserveAspectRatio="xMidYMid meet"
              onerror={() => failed.add(lane.id)}
            />
          {:else}
            <rect
              class="placeholder"
              data-part="icon"
              aria-hidden="true"
              x={round(lane.iconBox.x + 4)}
              y={round(lane.iconBox.y + 2)}
              width={round(Math.max(0, lane.iconBox.width - 8))}
              height={round(Math.max(0, lane.iconBox.height - 4))}
              rx="6"
            />
          {/if}
          {@render text(lane.name, 'name', 'name')}
          {#if lane.note !== null}
            {@render text(lane.note, 'note', 'note')}
          {/if}
        </g>
      {/each}

      {#each layout.rows as row (row.number)}
        {@const done = arrived(row)}
        {@const paint = rowPaint(row, done)}
        {@const end = row.x1 + (row.x2 - row.x1) * reach(row)}
        {@const dir = row.x2 >= row.x1 ? 1 : -1}
        {@const signY = (row.label.lines[0]?.y ?? row.labelBox.y + 10) - 4}
        <g
          class="row {row.state} {row.kind}"
          class:stopped={paint === 'stopped'}
          data-testid="sequence-row-{row.number}"
          data-step={row.stepId}
          data-state={row.state}
          data-shape={row.shape}
          data-paint={paint}
          data-from={row.from}
          data-to={row.to}
        >
          {#if row.state === 'current'}
            <rect
              class="band"
              x={round(row.band.x)}
              y={round(row.band.y + 2)}
              width={round(row.band.width)}
              height={round(row.band.height - 2)}
              rx="4"
            />
          {/if}
          <line
            class="separator"
            x1={round(row.band.x + 4)}
            x2={round(row.band.x + row.band.width - 4)}
            y1={round(row.band.y + 2)}
            y2={round(row.band.y + 2)}
          />
          {@render text(row.separator, 'separator-text', 'separator')}
          {#if row.shape === 'arrow'}
            <line
              class="arrow"
              data-testid="sequence-arrow-{row.number}"
              x1={round(row.x1)}
              x2={round(end)}
              y1={round(row.y)}
              y2={round(row.y)}
            />
            {#if reach(row) > 0}
              <path class="head" d="M{round(end)} {round(row.y)} l{-9 * dir} -5 v10 Z" />
            {/if}
            {#if paint === 'stopped'}
              <line
                class="barrier"
                data-testid="sequence-stop-{row.number}"
                x1={round(row.x2 + 4 * dir)}
                x2={round(row.x2 + 4 * dir)}
                y1={round(row.y - 8)}
                y2={round(row.y + 8)}
              />
            {/if}
          {/if}
          <rect
            class="label-box"
            data-part="label-box"
            x={round(row.labelBox.x)}
            y={round(row.labelBox.y)}
            width={round(row.labelBox.width)}
            height={round(row.labelBox.height)}
            rx="3"
          />
          <circle
            class="badge"
            cx={round(row.labelBox.x + LABEL_PAD + SIGN_ROOM / 2)}
            cy={round(signY)}
            r="6"
          />
          <path
            class="sign"
            class:shield={rowSign(row, done) === 'stopped'}
            data-sign={rowSign(row, done)}
            transform="translate({round(row.labelBox.x + LABEL_PAD + SIGN_ROOM / 2)} {round(
              signY,
            )})"
            d={SIGNS[rowSign(row, done)]}
          />
          {@render text(row.label, 'label', 'label')}
          <rect
            class="hit"
            role="button"
            tabindex="0"
            data-testid="sequence-goto-{row.number}"
            aria-label={rowName(row)}
            aria-current={row.state === 'current' ? 'step' : undefined}
            x={round(row.band.x)}
            y={round(row.band.y + 2)}
            width={round(row.band.width)}
            height={round(row.band.height - 2)}
            rx="4"
            onclick={() => {
              run('player.goto', { step: row.number });
            }}
            onkeydown={(event) => {
              onRowKey(event, row.number);
            }}
          />
        </g>
      {/each}
    </svg>
  </div>
  <figcaption class="step" data-testid="sequence-step" aria-live="polite">{caption}</figcaption>
</figure>

<style>
  /*
   * M6.1 shell: the view stands on the millimetre grid of the scene panel, with no frame of its
   * own. On a laptop it fills the panel's body (the one-screen grid gives it its height) and the
   * rows scroll inside it; on a phone it is as tall as its rows and the page scrolls.
   */
  .sequence {
    position: relative;
    margin: 0;
    min-width: 0;
    flex: 1 1 auto;
  }

  @media (min-width: 761px) {
    .sequence {
      min-height: 8rem;
    }

    .area {
      position: absolute;
      inset: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
  }

  .area > svg {
    display: block;
    width: 100%;
    height: auto;
    text-rendering: geometricPrecision;
  }

  .step {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .lifeline {
    stroke: var(--seq-lifeline);
    stroke-width: 1.5;
    stroke-dasharray: 4 5;
  }

  .placeholder {
    fill: var(--scene-placeholder);
    stroke: var(--seq-ink);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }

  .name {
    fill: var(--seq-ink);
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .note {
    fill: var(--seq-muted);
    font-family: var(--font-mono);
  }

  /*
   * A row takes the colour of its kind; a stopped message turns green where it stops. The line
   * keeps the colour of the kind that came (as the trail on the scene).
   */
  .row {
    --kind: var(--scene-message-legit);
    --paint: var(--kind);
  }

  .row.attack {
    --kind: var(--scene-message-attack);
  }

  .row.safe {
    --kind: var(--scene-message-safe);
  }

  .row.stopped {
    --paint: var(--scene-message-stopped);
  }

  .row.future {
    --kind: var(--seq-muted);
    --paint: var(--seq-muted);
  }

  .band {
    fill: var(--seq-band);
    stroke: var(--seq-band-line);
    stroke-width: 1.5;
  }

  .separator {
    stroke: var(--seq-lifeline);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .current .separator {
    stroke: none;
  }

  /* A halo of the paper under the letters: the lifelines they cross do not cut them. */
  .separator-text {
    fill: var(--seq-muted);
    font-family: var(--font-mono);
    text-transform: uppercase;
    stroke: var(--seq-paper);
    stroke-width: 3px;
    stroke-linejoin: round;
    paint-order: stroke;
  }

  .current .separator-text {
    fill: var(--seq-ink);
    stroke: var(--seq-band);
    font-weight: 700;
  }

  .arrow {
    stroke: var(--kind);
    stroke-width: 2;
  }

  .current .arrow {
    stroke-width: 3;
  }

  .future .arrow {
    stroke-dasharray: 5 4;
  }

  .head {
    fill: var(--paint);
  }

  .barrier {
    stroke: var(--paint);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .label-box {
    fill: var(--seq-paper);
    stroke: var(--paint);
    stroke-width: 1.5;
  }

  .future .label-box {
    stroke-dasharray: 3 3;
  }

  .current .label-box {
    fill: var(--paint);
  }

  .label {
    fill: var(--paint);
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .current .label {
    fill: var(--scene-message-text);
  }

  .badge {
    fill: var(--paint);
  }

  .current .badge {
    fill: var(--scene-message-text);
  }

  .sign {
    fill: none;
    stroke: var(--scene-message-text);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .current .sign {
    stroke: var(--paint);
  }

  .sign.shield {
    fill: var(--scene-message-text);
    stroke: none;
  }

  .current .sign.shield {
    fill: var(--paint);
  }

  .hit {
    fill: var(--seq-paper);
    fill-opacity: 0;
    cursor: pointer;
  }

  .hit:hover {
    stroke: var(--seq-band-line);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }
</style>
