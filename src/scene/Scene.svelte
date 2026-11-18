<script lang="ts">
  // The lesson scene (design M1.2 E1): an SVG drawn from the lesson data and the layout of
  // src/core/scene-layout. The message of the current step stands where the player clock says
  // (E2): its place is a pure function of the clock time since the step started, so the same
  // moment gives the same frame. Geometry is in SVG attributes, colours and fonts in classes
  // from tokens (CSP has no 'unsafe-inline' for styles, so no style= anywhere).
  import { MediaQuery, SvelteSet } from 'svelte/reactivity';
  import type { Clock } from '../core/clock';
  import type { SiteLesson } from '../core/lesson/site';
  import type { SceneState } from '../core/state';
  import { describeScene, describeStep, sceneTitle } from '../core/scene-layout/describe';
  import { layoutScene, RING_STROKE, type TextBlock } from '../core/scene-layout/layout';
  import { currentStep, layoutMessage, type MessageSign } from '../core/scene-layout/message';
  import { iconUrl } from './icons';

  const {
    lesson,
    scene,
    clock,
  }: { lesson: SiteLesson; scene: SceneState; clock: Pick<Clock, 'now' | 'subscribe'> } = $props();
  const uid = $props.id();

  /** The width the scene is drawn for; follows the width of its box. */
  let width = $state(760);
  /** Time of the player clock: the only time the scene knows. */
  let timeMs = $state(0);
  $effect(() => {
    timeMs = clock.now();
    return clock.subscribe((event) => {
      timeMs = event.timeMs;
    });
  });
  // S11: with reduced motion the message is at its target at once.
  const reduced = new MediaQuery('prefers-reduced-motion: reduce', false);
  /** Participants whose icon file failed to load: they get the placeholder too. */
  const failed = new SvelteSet<string>();

  const input = $derived({ participants: lesson.participants, zones: lesson.zones });
  const layout = $derived(layoutScene({ ...input, width }));
  const icons = $derived(new Map(lesson.participants.map((p) => [p.id, iconUrl(p.icon)])));
  const title = $derived(sceneTitle(lesson.title));
  const description = $derived(describeScene(input));
  const current = $derived(currentStep(lesson.steps, scene.defence, scene.step));
  const stepText = $derived(describeStep(lesson.participants, current));
  const message = $derived(
    current === null
      ? null
      : layoutMessage(layout, current.step, timeMs - scene.startedMs, reduced.current),
  );
  const tokenIcon = $derived(message?.token?.icon ?? null);
  // A token whose icon is unknown or failed to load shows only its paper and ring.
  const tokenUrl = $derived(
    tokenIcon === null || failed.has(`token:${tokenIcon}`) ? null : iconUrl(tokenIcon),
  );
  const round = (n: number) => Math.round(n * 10) / 10;

  /** The sign that doubles the colour, drawn as a path (no font has to have the glyph). */
  const SIGNS: Readonly<Record<MessageSign, string>> = {
    attack: 'M0 -4.5 V0.8 M0 3.6 V3.7',
    safe: 'M-4 0.2 L-1.2 3 L4 -2.8',
    right: 'M-4 0 H4 M1 -3 L4 0 L1 3',
    left: 'M4 0 H-4 M-1 -3 L-4 0 L-1 3',
    here: 'M0 0 V0.1',
    stopped: 'M0 -5.5 L4.5 -3.6 V0 C4.5 2.8 2.6 4.7 0 5.7 C-2.6 4.7 -4.5 2.8 -4.5 0 V-3.6 Z',
  };
</script>

{#snippet lines(block: TextBlock)}
  <!-- A space between lines, so the text reads as words (textContent, screen readers). -->
  <!-- An address broken after a dot (M1.2d) goes on with no space: it reads as one word. -->
  <!-- A line drawn narrower (textLength) starts at its left edge: Chromium centres such a line
       by its natural width, which pushed it 1.5 px aside (M1.2d). -->
  {#each block.lines as line, i (i)}{i > 0 && !line.glued ? ' ' : ''}<tspan
      x={round(block.anchor === 'middle' && line.fit !== null ? block.x - line.fit / 2 : block.x)}
      text-anchor={block.anchor === 'middle' && line.fit !== null ? 'start' : undefined}
      y={round(line.y)}
      textLength={line.fit === null ? undefined : round(line.fit)}
      lengthAdjust={line.fit === null ? undefined : 'spacingAndGlyphs'}>{line.text}</tspan
    >{/each}
{/snippet}

{#snippet sign(kind: MessageSign, testid: string)}
  <path
    class="sign"
    class:shield={kind === 'stopped'}
    data-testid={testid}
    data-sign={kind}
    d={SIGNS[kind]}
  />
{/snippet}

<figure class="scene" data-testid="scene" data-lesson={lesson.id} bind:clientWidth={width}>
  <svg
    viewBox="0 0 {round(layout.width)} {round(layout.height)}"
    role="img"
    aria-labelledby="{uid}-title {uid}-desc"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-desc" data-testid="scene-description">{description}</desc>
    <defs>
      <clipPath id="{uid}-token"><circle r="21" /></clipPath>
    </defs>
    <rect class="paper" width={round(layout.width)} height={round(layout.height)} />

    {#each layout.zones as zone (zone.id)}
      <g
        class="zone"
        class:danger={zone.danger}
        data-testid="zone-{zone.id}"
        data-members={zone.members.join(' ')}
      >
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
      {@const url = failed.has(p.id) ? null : (icons.get(p.id) ?? null)}
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
            onerror={() => failed.add(p.id)}
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

    {#if message !== null && current !== null}
      <g
        class="message {message.trailPaint}"
        class:stopped={message.paint === 'stopped'}
        data-testid="message"
        data-step={current.step.id}
        data-from={current.step.from}
        data-to={current.step.to}
        data-kind={message.kind}
        data-paint={message.paint}
        data-stopped={message.stopped}
        data-arrived={message.arrived}
        data-progress={Math.round(message.progress * 1000) / 1000}
      >
        <rect
          class="ring"
          data-testid="message-ring"
          x={round(message.ring.x)}
          y={round(message.ring.y)}
          width={round(message.ring.width)}
          height={round(message.ring.height)}
          stroke-width={RING_STROKE}
          rx="12"
        />
        {#if message.trail !== null}
          <line
            class="trail"
            data-testid="message-trail"
            x1={round(message.trail.x1)}
            y1={round(message.trail.y)}
            x2={round(message.trail.x2)}
            y2={round(message.trail.y)}
          />
        {/if}
        <g transform="translate({round(message.x)} {round(message.y)})">
          <text
            class="word"
            data-testid="message-word"
            x={message.wordFit === null ? undefined : round(-message.wordFit / 2)}
            y={round(message.wordY - message.y)}
            text-anchor={message.wordFit === null ? 'middle' : 'start'}
            textLength={message.wordFit === null ? undefined : round(message.wordFit)}
            lengthAdjust={message.wordFit === null ? undefined : 'spacingAndGlyphs'}
            font-size="11">{message.word}</text
          >
          {#if message.plaque !== null}
            {@const plaque = message.plaque}
            {@const w = plaque.width}
            {@const h = plaque.height}
            <g data-testid="message-plaque" data-lines={plaque.lines.length}>
              <rect
                class="shadow"
                x={round(-w / 2 + 3)}
                y={round(-h / 2 + 3)}
                width={round(w)}
                height={round(h)}
                rx="5"
              />
              <rect
                class="plaque"
                x={round(-w / 2)}
                y={round(-h / 2)}
                width={round(w)}
                height={round(h)}
                rx="5"
              />
              <g transform="translate({round(-w / 2 + plaque.signX)} {round(plaque.signY)})">
                {@render sign(message.sign, 'message-sign')}
              </g>
              <text class="label" data-testid="message-label" font-size="11"
                >{#each plaque.lines as line, i (i)}{i > 0 ? ' ' : ''}<tspan
                    x={round(-w / 2 + line.x)}
                    y={round(line.y)}
                    textLength={line.fit === null ? undefined : round(line.fit)}
                    lengthAdjust={line.fit === null ? undefined : 'spacingAndGlyphs'}
                    >{line.text}</tspan
                  >{/each}</text
              >
            </g>
          {:else if message.token !== null}
            <g data-testid="message-token" data-icon={message.token.icon}>
              <circle class="shadow" cx="2" cy="2" r="21" />
              <g clip-path="url(#{uid}-token)">
                <rect class="token-paper" x="-22" y="-22" width="44" height="44" />
                {#if tokenUrl !== null}
                  <image
                    href={tokenUrl}
                    x="-24"
                    y="-22"
                    width="48"
                    height="43"
                    onerror={() => failed.add(`token:${tokenIcon ?? ''}`)}
                  />
                {/if}
              </g>
              <circle class="token-ring" r="21" />
              <circle class="badge" cx="16" cy="-15" r="8" />
              <g transform="translate(16 -15)">
                {@render sign(message.sign, 'message-sign')}
              </g>
            </g>
          {/if}
        </g>
      </g>
    {/if}
  </svg>
  <figcaption class="step" data-testid="scene-step" aria-live="polite">{stepText}</figcaption>
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

  .step {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-top: var(--line-width) solid var(--line);
    background: var(--panel);
    color: var(--ink);
    font-size: var(--text-sm);
    line-height: var(--leading);
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

  /*
   * The message: one colour per kind, always with a sign and a word (E8). Where a stopped
   * message stops, plaque, word and ring turn into the defence green; the trail keeps the
   * colour of the kind that came (M1.2d, K62).
   */
  .message {
    --kind: var(--scene-message-legit);
    --paint: var(--kind);
  }

  .message.attack {
    --kind: var(--scene-message-attack);
  }

  .message.safe {
    --kind: var(--scene-message-safe);
  }

  .message.stopped {
    --paint: var(--scene-message-stopped);
  }

  .ring {
    fill: none;
    stroke: var(--paint);
  }

  .trail {
    stroke: var(--kind);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .shadow {
    fill: var(--scene-ink);
    opacity: 0.3;
  }

  .plaque,
  .badge {
    fill: var(--paint);
  }

  .label {
    fill: var(--scene-message-text);
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .word {
    fill: var(--paint);
    font-family: var(--font-mono);
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .sign {
    fill: none;
    stroke: var(--scene-message-text);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sign.shield {
    fill: var(--scene-message-text);
    stroke: none;
  }

  .token-paper {
    fill: var(--scene-paper);
  }

  .token-ring {
    fill: none;
    stroke: var(--paint);
    stroke-width: 3;
  }
</style>
