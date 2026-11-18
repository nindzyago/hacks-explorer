<script lang="ts">
  // The lesson scene (design M1.2 E1): an SVG drawn from the lesson data and the layout of
  // src/core/scene-layout. Still in M1.2a; the message and its movement come in M1.2b.
  // Geometry is in SVG attributes, colours and fonts in classes from tokens (CSP has no
  // 'unsafe-inline' for styles, so no style= anywhere).
  import type { SiteLesson } from '../core/lesson/site';
  import { describeScene, sceneTitle } from '../core/scene-layout/describe';
  import { layoutScene, type TextBlock } from '../core/scene-layout/layout';
  import { iconUrl } from './icons';

  const { lesson }: { lesson: SiteLesson } = $props();
  const uid = $props.id();

  /** The width the scene is drawn for; follows the width of its box. */
  let width = $state(760);
  const input = $derived({ participants: lesson.participants, zones: lesson.zones });
  const layout = $derived(layoutScene({ ...input, width }));
  const icons = $derived(new Map(lesson.participants.map((p) => [p.id, iconUrl(p.icon)])));
  const title = $derived(sceneTitle(lesson.title));
  const description = $derived(describeScene(input));
  const round = (n: number) => Math.round(n * 10) / 10;
</script>

{#snippet lines(block: TextBlock)}
  {#each block.lines as line, i (i)}
    <tspan x={round(block.x)} y={round(line.y)}>{line.text}</tspan>
  {/each}
{/snippet}

<figure class="scene" data-testid="scene" bind:clientWidth={width}>
  <svg
    viewBox="0 0 {round(layout.width)} {round(layout.height)}"
    role="img"
    aria-labelledby="{uid}-title {uid}-desc"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-desc" data-testid="scene-description">{description}</desc>
    <rect class="paper" width={round(layout.width)} height={round(layout.height)} />

    {#each layout.zones as zone (zone.id)}
      <g class="zone" class:danger={zone.danger} data-testid="zone-{zone.id}">
        <rect
          class="frame"
          data-part="frame"
          x={round(zone.rect.x)}
          y={round(zone.rect.y)}
          width={round(zone.rect.width)}
          height={round(zone.rect.height)}
          rx="10"
        />
        <text class="zone-label" data-part="label" font-size={zone.label.fontSize}>
          {@render lines(zone.label)}
        </text>
      </g>
    {/each}

    {#if layout.participants.length > 1}
      <line
        class="lane"
        x1={round(layout.lane.x1)}
        y1={round(layout.lane.y)}
        x2={round(layout.lane.x2)}
        y2={round(layout.lane.y)}
      />
    {/if}

    {#each layout.participants as p (p.id)}
      {@const url = icons.get(p.id) ?? null}
      <g class="participant" data-testid="participant-{p.id}">
        <line
          class="lane"
          x1={round(p.cx)}
          y1={round(layout.lane.y)}
          x2={round(p.cx)}
          y2={round(p.icon.y + 6)}
        />
        {#if url !== null}
          <image
            data-part="icon"
            href={url}
            x={round(p.icon.x)}
            y={round(p.icon.y)}
            width={round(p.icon.width)}
            height={round(p.icon.height)}
            preserveAspectRatio="xMidYMid meet"
          />
        {:else}
          <g data-testid="icon-placeholder" data-part="icon">
            <rect
              class="placeholder"
              x={round(p.icon.x + p.icon.width * 0.15)}
              y={round(p.icon.y + p.icon.height * 0.1)}
              width={round(p.icon.width * 0.7)}
              height={round(p.icon.height * 0.8)}
              rx="12"
            />
            <text
              class="placeholder-mark"
              x={round(p.cx)}
              y={round(p.icon.y + p.icon.height * 0.5 + 8)}
              font-size="24"
              text-anchor="middle">?</text
            >
          </g>
        {/if}
        <text class="name" data-part="name" text-anchor="middle" font-size={p.name.fontSize}>
          {@render lines(p.name)}
        </text>
        {#if p.note !== null}
          <text class="note" data-part="note" text-anchor="middle" font-size={p.note.fontSize}>
            {@render lines(p.note)}
          </text>
        {/if}
      </g>
    {/each}
  </svg>
</figure>

<style>
  .scene {
    margin: 0;
    min-width: 0;
    background: var(--scene-paper);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .paper {
    fill: var(--scene-paper);
  }

  .frame {
    fill: none;
    stroke: var(--scene-ink);
    stroke-width: 1.5;
    stroke-dasharray: 2 7;
    stroke-linecap: round;
  }

  .zone-label {
    fill: var(--scene-ink);
    font-family: var(--font-mono);
    letter-spacing: 1px;
  }

  .danger .frame {
    stroke: var(--scene-attack);
  }

  .danger .zone-label {
    fill: var(--scene-attack-text);
  }

  .lane {
    stroke: var(--scene-ink);
    stroke-width: 1.5;
    opacity: 0.25;
  }

  .name {
    fill: var(--scene-ink);
    font-family: var(--font-sans);
    font-weight: 700;
  }

  .note {
    fill: var(--scene-muted);
    font-family: var(--font-mono);
  }

  .placeholder {
    fill: var(--scene-placeholder);
    stroke: var(--scene-ink);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }

  .placeholder-mark {
    fill: var(--scene-ink);
    font-family: var(--font-sans);
    font-weight: 700;
  }
</style>
