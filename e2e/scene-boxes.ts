// The real boxes of what the scene draws, as the browser lays them out, and the checks on them
// (M1.2a, M1.2b; M1.2c adds the message: its ring, its plaque or token and its word). Shared by
// e2e/scene.spec.ts, e2e/message.spec.ts and e2e/phone.spec.ts.
import type { Page } from '@playwright/test';

export interface Box {
  readonly what: string;
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  /** For the parts of a zone: owners (`participant-<id>`) of its members. */
  readonly members?: readonly string[];
}

/** The message as drawn: its parts, who sends and receives it, and how it is painted. */
export interface MessageBoxes {
  readonly from: string;
  readonly to: string;
  readonly progress: number;
  /** The ring around the receiver: its geometry and the width of its line. */
  readonly ring: Box & { readonly stroke: number };
  /** The plaque or the token, shadow and badge included. */
  readonly body: Box;
  readonly word: Box;
  readonly trail: Box | null;
  /** The lane the message stands on (M1.2d): its height in the page. */
  readonly laneY: number;
  /**
   * What makes a part of the message invisible: «ring: opacity 0», «word: display none»,
   * «ring: stroke-opacity 0», «word: contrast 1.0» (M1.2d: against what it is drawn on).
   */
  readonly unpainted: readonly string[];
  /** The computed paint of each part (`rgb(…)`), for the colour checks of M1.2d. */
  readonly paint: {
    readonly ring: string;
    readonly body: string;
    readonly word: string;
    readonly label: string | null;
    readonly sign: string;
    readonly trail: string | null;
  };
}

/** The real boxes of everything drawn in the scene, as the browser lays them out. */
export async function sceneBoxes(
  page: Page,
): Promise<{ scene: Box; boxes: Box[]; message: MessageBoxes | null }> {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="scene"] svg');
    if (svg === null) throw new Error('no scene');
    const box = (element: Element, what: string, owner: string) => {
      // A text of several lines: the lines themselves. The space between two <tspan>s (for
      // screen readers) has no ink, but Chromium counts it after the first line (M1.2d).
      const spans = Array.from(element.querySelectorAll(':scope > tspan'));
      const rects = spans.map((s) => s.getBoundingClientRect());
      const r =
        rects.length > 1
          ? new DOMRect(
              Math.min(...rects.map((q) => q.left)),
              Math.min(...rects.map((q) => q.top)),
              Math.max(...rects.map((q) => q.right)) - Math.min(...rects.map((q) => q.left)),
              Math.max(...rects.map((q) => q.bottom)) - Math.min(...rects.map((q) => q.top)),
            )
          : element.getBoundingClientRect();
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      return { what, owner, x: r.x, y: r.y, width: r.width, height: r.height, fontSize };
    };
    /** The smallest box around `elements` (a plaque's rects, a token's circles). */
    const union = (elements: Element[], what: string, owner: string) => {
      const rects = elements.map((e) => e.getBoundingClientRect());
      if (rects.length === 0) return { what, owner, x: 0, y: 0, width: 0, height: 0, fontSize: 0 };
      const x = Math.min(...rects.map((r) => r.left));
      const y = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return { what, owner, x, y, width: right - x, height: bottom - y, fontSize: 0 };
    };
    type Rgb = readonly [number, number, number];
    /** `rgb(…)` / `rgba(…)` as channels and alpha; null for `none`, a url() or a keyword. */
    const parse = (value: string): { rgb: Rgb; alpha: number } | null => {
      const m = /^rgba?\(([^)]*)\)$/.exec(value.trim());
      if (m === null) return null;
      const [r, g, b, a] = (m[1] ?? '').split(/[\s,/]+/).filter((x) => x !== '');
      return { rgb: [Number(r), Number(g), Number(b)], alpha: a === undefined ? 1 : Number(a) };
    };
    const luminance = (c: Rgb) => {
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
    };
    const contrast = (a: Rgb, b: Rgb) => {
      const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const blend = (c: Rgb, alpha: number, under: Rgb): Rgb => [
      c[0] * alpha + under[0] * (1 - alpha),
      c[1] * alpha + under[1] * (1 - alpha),
      c[2] * alpha + under[2] * (1 - alpha),
    ];
    const paper = parse(getComputedStyle(svg.querySelector('.paper') ?? svg).fill)?.rgb ?? [
      255, 255, 255,
    ];

    /**
     * How `element` is seen: why it would not be (hidden by itself or an ancestor; not painted;
     * M1.2d: a fill- or stroke-opacity near 0) and the colour it shows over `under`, its
     * opacities applied.
     */
    const look = (
      element: Element | null,
      what: string,
      paint: 'fill' | 'stroke',
      under: Rgb,
    ): { problems: string[]; seen: Rgb | null; css: string } => {
      if (element === null) return { problems: [`${what}: missing`], seen: null, css: '' };
      const out: string[] = [];
      let opacity = 1;
      for (let e: Element | null = element; e !== null && e !== svg; e = e.parentElement) {
        const style = getComputedStyle(e);
        if (style.display === 'none') out.push(`${what}: display none`);
        opacity *= Number.parseFloat(style.opacity);
      }
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') out.push(`${what}: visibility ${style.visibility}`);
      if (opacity < 0.5) out.push(`${what}: opacity ${String(opacity)}`);
      const own = Number.parseFloat(paint === 'fill' ? style.fillOpacity : style.strokeOpacity);
      if (own < 0.5) out.push(`${what}: ${paint}-opacity ${String(own)}`);
      const css = paint === 'fill' ? style.fill : style.stroke;
      const colour = parse(css);
      if (css === 'none' || colour?.alpha === 0) out.push(`${what}: no ${paint}`);
      if (paint === 'stroke' && Number.parseFloat(style.strokeWidth) < 1) {
        out.push(`${what}: stroke ${style.strokeWidth}`);
      }
      const r = element.getBoundingClientRect();
      // A line (the trail) or a sign (the dot of a step that stays) may have no height or
      // width; anything else has both.
      const thin = element.tagName === 'line' || element.tagName === 'path';
      if (thin ? r.width <= 0 && r.height <= 0 : r.width <= 0 || r.height <= 0) {
        out.push(`${what}: empty box`);
      }
      const seen = colour === null ? null : blend(colour.rgb, colour.alpha * opacity * own, under);
      return { problems: out, seen, css };
    };
    /**
     * The part must stand out from what it is drawn on (M1.2d): text 4.5:1, a line or a
     * plaque 3:1 (WCAG 1.4.3, 1.4.11).
     */
    const against = (what: string, seen: Rgb | null, under: Rgb, least: number) => {
      if (seen === null) return [];
      const ratio = contrast(seen, under);
      return ratio < least ? [`${what}: contrast ${ratio.toFixed(1)}`] : [];
    };

    const boxes = [];
    for (const g of svg.querySelectorAll('[data-testid^="participant-"]')) {
      const owner = g.getAttribute('data-testid') ?? '';
      for (const el of g.querySelectorAll('[data-part]')) {
        boxes.push(box(el, el.getAttribute('data-part') ?? '', owner));
      }
    }
    for (const g of svg.querySelectorAll('[data-testid^="zone-"]')) {
      const owner = g.getAttribute('data-testid') ?? '';
      const members = (g.getAttribute('data-members') ?? '')
        .split(' ')
        .filter((m) => m !== '')
        .map((m) => `participant-${m}`);
      for (const el of g.querySelectorAll('[data-part]')) {
        boxes.push({ ...box(el, el.getAttribute('data-part') ?? '', owner), members });
      }
    }

    let message = null;
    const g = svg.querySelector('[data-testid="message"]');
    if (g !== null) {
      const ring = g.querySelector('[data-testid="message-ring"]');
      const word = g.querySelector('[data-testid="message-word"]');
      const trail = g.querySelector('[data-testid="message-trail"]');
      const plaque = g.querySelector('[data-testid="message-plaque"]');
      const token = g.querySelector('[data-testid="message-token"]');
      const bodyParts = Array.from(
        plaque !== null
          ? plaque.querySelectorAll(':scope > rect')
          : (token?.querySelectorAll('circle') ?? []),
      );
      const lane = svg.querySelector(':scope > line.lane');
      const ringLook = look(ring, 'ring', 'stroke', paper);
      const bodyLook = look(
        plaque?.querySelector('.plaque') ?? token?.querySelector('.token-ring') ?? null,
        'body',
        plaque !== null ? 'fill' : 'stroke',
        paper,
      );
      const wordLook = look(word, 'word', 'fill', paper);
      const label = plaque?.querySelector('[data-testid="message-label"]') ?? null;
      const labelLook =
        plaque === null ? null : look(label, 'label', 'fill', bodyLook.seen ?? paper);
      const sign = g.querySelector('[data-testid="message-sign"]');
      const signLook = look(
        sign,
        'sign',
        sign?.getAttribute('data-sign') === 'stopped' ? 'fill' : 'stroke',
        bodyLook.seen ?? paper,
      );
      const trailLook = trail === null ? null : look(trail, 'trail', 'stroke', paper);
      message = {
        laneY: lane === null ? Number.NaN : lane.getBoundingClientRect().y,
        paint: {
          ring: ringLook.css,
          body: bodyLook.css,
          word: wordLook.css,
          label: labelLook?.css ?? null,
          sign: signLook.css,
          trail: trailLook?.css ?? null,
        },
        from: `participant-${g.getAttribute('data-from') ?? ''}`,
        to: `participant-${g.getAttribute('data-to') ?? ''}`,
        progress: Number(g.getAttribute('data-progress')),
        ring: {
          ...(ring === null
            ? { what: 'ring', owner: 'message', x: 0, y: 0, width: 0, height: 0, fontSize: 0 }
            : box(ring, 'ring', 'message')),
          stroke: ring === null ? 0 : Number.parseFloat(getComputedStyle(ring).strokeWidth),
        },
        body: union(bodyParts, plaque !== null ? 'plaque' : 'token', 'message'),
        word:
          word === null
            ? { what: 'word', owner: 'message', x: 0, y: 0, width: 0, height: 0, fontSize: 0 }
            : box(word, 'word', 'message'),
        trail: trail === null ? null : box(trail, 'trail', 'message'),
        unpainted: [
          ...ringLook.problems,
          ...against('ring', ringLook.seen, paper, 3),
          ...bodyLook.problems,
          ...against('body', bodyLook.seen, paper, 3),
          ...wordLook.problems,
          ...against('word', wordLook.seen, paper, 4.5),
          ...(labelLook === null
            ? []
            : [
                ...labelLook.problems,
                ...against('label', labelLook.seen, bodyLook.seen ?? paper, 4.5),
              ]),
          ...signLook.problems,
          ...against('sign', signLook.seen, bodyLook.seen ?? paper, 3),
          ...(trailLook?.problems ?? []),
        ],
      };
    }
    return { scene: box(svg, 'scene', 'scene'), boxes, message };
  });
}

export const inside = (a: Box, b: Box, slack = 0.5) =>
  a.x >= b.x - slack &&
  a.y >= b.y - slack &&
  a.x + a.width <= b.x + b.width + slack &&
  a.y + a.height <= b.y + b.height + slack;
export const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;
/** Paper between a ring and the text or frame next to it (M1.2d), and rounding slack. */
const PAPER = 2;
const SLACK = 0.25;
/** Half the width of a zone frame's line. */
const FRAME_HALF = 0.75;
/** At most this share of a step participant's icon may lie under the message (K59, M1.2d). */
export const COVER = 0.3;
/**
 * Paper between a zone label and the word under it, between their boxes as the browser gives
 * them (font ascent and descent included, so the letters are further apart).
 */
export const WORD_BELOW_LABEL = 6;
const grow = (b: Box, d: number): Box => ({
  ...b,
  x: b.x - d,
  y: b.y - d,
  width: b.width + 2 * d,
  height: b.height + 2 * d,
});

/**
 * Everything wrong with the still boxes: a box outside the scene; two drawn things on top of
 * each other; and, for zone frames (M1.2b), a frame over another zone, a member outside its
 * frame or a stranger inside it.
 */
export function layoutProblems(scene: Box, boxes: readonly Box[]): string[] {
  const out = boxes.filter((b) => !inside(b, scene)).map((b) => `${b.owner} ${b.what} outside`);
  const drawn = boxes.filter((b) => b.what !== 'frame');
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      const a = drawn[i];
      const b = drawn[j];
      if (a !== undefined && b !== undefined && overlap(a, b)) {
        out.push(`${a.owner} ${a.what} × ${b.owner} ${b.what}`);
      }
    }
  }
  for (const frame of boxes.filter((b) => b.what === 'frame')) {
    for (const b of boxes) {
      if (b === frame) continue;
      const own = b.owner === frame.owner || (frame.members ?? []).includes(b.owner);
      if (own && !inside(b, frame)) out.push(`${b.owner} ${b.what} leaves ${frame.owner}`);
      // M1.2d: a name or note keeps 2 px of paper from its frame's line.
      else if (
        own &&
        (b.what === 'name' || b.what === 'note') &&
        !inside(b, grow(frame, -(FRAME_HALF + PAPER)), SLACK)
      ) {
        out.push(`${b.owner} ${b.what} close to ${frame.owner} frame`);
      }
      if (!own && overlap(b, frame)) out.push(`${b.owner} ${b.what} × ${frame.owner} frame`);
    }
  }
  return out;
}

/**
 * Everything wrong with the message at rest (M1.2c): a part not painted or outside the scene;
 * the ring's line over its participant's icon or text, over anything of another participant,
 * a zone label, or a zone frame other than its participant's own (and out of that one); the
 * plaque, token or word over any text, over the icon of a participant not in the step, across a
 * zone frame or out of the zone of the participant it stands at; plaque or token over the word;
 * the trail over any text. M1.2d: a part painted with no opacity or in a colour that does not
 * stand out from what it is on (word and label 4.5:1, ring, plaque and sign 3:1), the plaque
 * label hidden; a name or note closer than 2 px to the ring, the ring closer than 2 px of
 * paper to its zone frame; the plaque or token off the lane; the plaque or token over more
 * than the top COVER of a step participant's icon or over it from below; the word less than
 * WORD_BELOW_LABEL under a zone label.
 */
export function messageProblems(scene: Box, boxes: readonly Box[], m: MessageBoxes): string[] {
  const out = [...m.unpainted];
  const parts = [m.ring, m.body, m.word, ...(m.trail === null ? [] : [m.trail])];
  for (const b of parts) if (!inside(b, scene)) out.push(`message ${b.what} outside`);
  const frames = boxes.filter((b) => b.what === 'frame');
  const texts = boxes.filter((b) => b.what === 'name' || b.what === 'note' || b.what === 'label');
  const zoneOf = (owner: string) => frames.find((f) => (f.members ?? []).includes(owner));

  const inner = grow(m.ring, -m.ring.stroke / 2);
  const outer = grow(m.ring, m.ring.stroke / 2);
  for (const b of boxes) {
    if (b.what === 'frame') continue;
    if (b.owner === m.to) {
      if (!inside(b, inner)) out.push(`ring × ${b.owner} ${b.what}`);
      // M1.2d: names and notes keep 2 px of paper from the ring's line, at the sides.
      else if (
        (b.what === 'name' || b.what === 'note') &&
        (b.x < inner.x + PAPER - SLACK || b.x + b.width > inner.x + inner.width - PAPER + SLACK)
      ) {
        const room = Math.min(b.x - inner.x, inner.x + inner.width - b.x - b.width);
        out.push(`ring ${room.toFixed(1)} px from ${b.owner} ${b.what}`);
      }
    } else if (overlap(outer, b)) out.push(`ring × ${b.owner} ${b.what}`);
  }
  const ringZone = zoneOf(m.to);
  for (const f of frames) {
    if (f === ringZone) {
      if (!inside(outer, f, 0)) out.push(`ring leaves ${f.owner}`);
      // M1.2d: 2 px of paper between the ring's line and the frame's line (1.5 px wide).
      else if (!inside(outer, grow(f, -(FRAME_HALF + PAPER)), SLACK)) {
        out.push(`ring close to ${f.owner} frame`);
      }
    } else if (overlap(outer, f)) out.push(`ring × ${f.owner} frame`);
  }

  // M1.2d: the plaque or token stands on the lane, not pushed up or down off it.
  const middle = m.body.y + m.body.height / 2;
  if (Math.abs(middle - m.laneY) > 2) {
    out.push(`${m.body.what} off the lane by ${(middle - m.laneY).toFixed(1)} px`);
  }
  // K59 made precise (M1.2d): the plaque or token may lie on the top of the icon of the
  // sender or receiver, from above only, over at most COVER of the icon's height.
  for (const icon of boxes.filter((b) => b.what === 'icon')) {
    if (icon.owner !== m.from && icon.owner !== m.to) continue;
    if (!overlap(m.body, icon)) continue;
    const covered = Math.min(m.body.y + m.body.height, icon.y + icon.height) - icon.y;
    if (m.body.y >= icon.y || covered > COVER * icon.height) {
      out.push(`${m.body.what} covers ${icon.owner} icon`);
    }
  }
  // M1.2d: the word does not read as a second line of a zone label right above it.
  for (const label of boxes.filter((b) => b.what === 'label')) {
    const gap = m.word.y - (label.y + label.height);
    const side = m.word.x < label.x + label.width && label.x < m.word.x + m.word.width;
    if (side && gap >= 0 && gap < WORD_BELOW_LABEL) {
      out.push(`word ${gap.toFixed(1)} px under ${label.owner} label`);
    }
  }

  const at = m.progress >= 1 ? m.to : m.from;
  const home = zoneOf(at);
  for (const part of [m.body, m.word]) {
    for (const t of texts) if (overlap(part, t)) out.push(`${part.what} × ${t.owner} ${t.what}`);
    for (const icon of boxes.filter((b) => b.what === 'icon')) {
      if (icon.owner !== m.from && icon.owner !== m.to && overlap(part, icon)) {
        out.push(`${part.what} × ${icon.owner} icon`);
      }
    }
    for (const f of frames) {
      if (overlap(part, f) && !inside(part, f, 0)) out.push(`${part.what} crosses ${f.owner}`);
    }
    if (home !== undefined && !inside(part, home, 0)) out.push(`${part.what} leaves ${home.owner}`);
  }
  if (overlap(m.body, m.word)) out.push(`${m.body.what} × word`);
  if (m.trail !== null) {
    for (const t of texts) if (overlap(m.trail, t)) out.push(`trail × ${t.owner} ${t.what}`);
  }
  return out;
}
