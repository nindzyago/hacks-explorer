<script lang="ts">
  // The lesson scene (design M1.2 E1): an SVG drawn from the lesson data and the layout of
  // src/core/scene-layout. The message of the current step stands where the player clock says
  // (E2): its place is a pure function of the clock time since the step started, so the same
  // moment gives the same frame. Geometry is in SVG attributes, colours and fonts in classes
  // from tokens (CSP has no 'unsafe-inline' for styles, so no style= anywhere).
  import { MediaQuery, SvelteSet } from 'svelte/reactivity';
  import type { Clock } from '../core/clock';
  import type { SiteLesson } from '../core/lesson/site';
  import { elapsedMs, type PlayerState } from '../core/player/player';
  import { describeScene, describeStep, sceneTitle } from '../core/scene-layout/describe';
  import { layoutScene, RING_STROKE, type TextBlock } from '../core/scene-layout/layout';
  import { currentStep, layoutMessage, type MessageSign } from '../core/scene-layout/message';
  import type { Translate } from '../services/i18n/i18n';
  import { openTerm } from '../ui/terms';
  import { iconUrl } from './icons';

  const {
    lesson,
    scene,
    clock,
    t,
  }: {
    lesson: SiteLesson;
    /** What the player says (M1.3): step, mode, start of the step on the clock, speed. */
    scene: Pick<PlayerState, 'step' | 'defence' | 'startedMs' | 'speed'>;
    clock: Pick<Clock, 'now' | 'subscribe'>;
    /** The interface strings of the page's language (M2.3). */
    t: Translate;
  } = $props();
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
  const title = $derived(sceneTitle(lesson.title, t));
  const description = $derived(describeScene(input, t));
  const current = $derived(currentStep(lesson.steps, scene.defence, scene.step));
  const stepText = $derived(describeStep(lesson.participants, current, t));
  const message = $derived(
    current === null
      ? null
      : layoutMessage(layout, current.step, elapsedMs(scene, timeMs), reduced.current, t),
  );
  const tokenIcon = $derived(message?.token?.icon ?? null);
  // A token whose icon is unknown or failed to load shows only its paper and ring.
  const tokenUrl = $derived(
    tokenIcon === null || failed.has(`token:${tokenIcon}`) ? null : iconUrl(tokenIcon),
  );
  const round = (n: number) => Math.round(n * 10) / 10;

  // M2.4 (K7): a participant or zone with `term:` opens its glossary definition on a click,
  // Enter or Space, through an invisible button over its icon and labels (or the zone label).
  const terms = $derived(
    new Map<string, { readonly term: string; readonly name: string }>([
      ...lesson.participants.flatMap((p) =>
        p.term === null ? [] : [[`p:${p.id}`, { term: p.term, name: p.name }] as const],
      ),
      ...lesson.zones.flatMap((z) =>
        z.term === null ? [] : [[`z:${z.id}`, { term: z.term, name: z.label }] as const],
      ),
    ]),
  );

  function onTermKey(event: KeyboardEvent, id: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    event.preventDefault();
    openTerm(id, event.currentTarget instanceof Element ? event.currentTarget : null);
  }

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

{#snippet hit(
  key: string,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  testid: string,
  pad: number,
)}
  {@const link = terms.get(key)}
  {#if link !== undefined}
    <rect
      class="hit"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      aria-label={t('scene.term', { name: link.name })}
      data-testid={testid}
      data-term={link.term}
      x={round(box.x - pad)}
      y={round(box.y - pad)}
      width={round(box.width + pad * 2)}
      height={round(box.height + pad * 2)}
      rx="8"
      onclick={(event) => {
        openTerm(link.term, event.currentTarget);
      }}
      onkeydown={(event) => {
        onTermKey(event, link.term);
      }}
    />
  {/if}
{/snippet}

<figure class="scene" data-testid="scene" data-lesson={lesson.id} bind:clientWidth={width}>
  <svg
    viewBox="0 0 {round(layout.width)} {round(layout.height)}"
    role="group"
    aria-labelledby="{uid}-title"
    aria-describedby="{uid}-desc"
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
        <text
          class="zone-label"
          data-part="label"
          aria-hidden="true"
          font-size={zone.label.fontSize}
        >
          {@render lines(zone.label)}
        </text>
        {@render hit(`z:${zone.id}`, zone.label.box, `zone-term-${zone.id}`, 4)}
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
            aria-hidden="true"
            href={url}
            x={round(p.icon.x)}
            y={round(p.icon.y)}
            width={round(p.icon.width)}
            height={round(p.icon.height)}
            preserveAspectRatio="xMidYMid meet"
            onerror={() => failed.add(p.id)}
          />
        {:else}
          <g data-testid="icon-placeholder" data-part="icon" aria-hidden="true">
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
        <text
          class="name"
          data-part="name"
          aria-hidden="true"
          text-anchor="middle"
          font-size={p.name.fontSize}
        >
          {@render lines(p.name)}
        </text>
        {#if p.note !== null}
          <text
            class="note"
            data-part="note"
            aria-hidden="true"
            text-anchor="middle"
            font-size={p.note.fontSize}
          >
            {@render lines(p.note)}
          </text>
        {/if}
        {@render hit(`p:${p.id}`, p.area, `participant-term-${p.id}`, 0)}
      </g>
    {/each}

    {#if message !== null && current !== null}
      <g
        class="message {message.trailPaint}"
        class:stopped={message.paint === 'stopped'}
        data-testid="message"
        aria-hidden="true"
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
  <!-- M1.3: the «Ход атаки» table shows the step to the eye; the caption stays for screen
       readers only (announced on every step change). -->
  <figcaption class="step" data-testid="scene-step" aria-live="polite">{stepText}</figcaption>
</figure>

<style>
  /* M6.1: the frame and the millimetre grid belong to the scene panel around it (src/ui/App). */
  .scene {
    position: relative;
    margin: 0;
    min-width: 0;
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    /* CI1: unhinted text, at the advances the layout counts on; Chromium on Linux otherwise
       rounds every glyph to whole pixels and names come wider than laid out. */
    text-rendering: geometricPrecision;
  }

  /* Visible to screen readers only (M1.3): the table under the scene shows the step. */
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

  /* The grid of the panel shows through the paper (M6.1). */
  .paper {
    fill: none;
  }

  /* M6.1: a zone is a dashed blueprint frame. */
  .frame {
    fill: none;
    stroke: var(--zone-line);
    stroke-width: 1.5;
    stroke-dasharray: 6 5;
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

  /* An invisible button over a participant or a zone label with a term (M2.4). */
  .hit {
    fill: var(--scene-paper);
    fill-opacity: 0;
    stroke: none;
    cursor: pointer;
  }

  /* The focus ring is the page's own (S6); a mouse over it gets a dashed frame. */
  .hit:hover {
    stroke: var(--legit);
    stroke-width: 2;
    stroke-dasharray: 4 4;
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
