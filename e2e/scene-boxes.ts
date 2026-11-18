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
  /** What makes a part of the message invisible: «ring: opacity 0», «word: display none». */
  readonly unpainted: readonly string[];
}

/** The real boxes of everything drawn in the scene, as the browser lays them out. */
export async function sceneBoxes(
  page: Page,
): Promise<{ scene: Box; boxes: Box[]; message: MessageBoxes | null }> {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="scene"] svg');
    if (svg === null) throw new Error('no scene');
    const box = (element: Element, what: string, owner: string) => {
      const r = element.getBoundingClientRect();
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
    /** Why `element` would not be seen: hidden by itself or an ancestor, or not painted. */
    const unpainted = (element: Element | null, what: string, paint: 'fill' | 'stroke') => {
      if (element === null) return [`${what}: missing`];
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
      const colour = paint === 'fill' ? style.fill : style.stroke;
      if (colour === 'none' || colour.endsWith(', 0)')) out.push(`${what}: no ${paint}`);
      if (paint === 'stroke' && Number.parseFloat(style.strokeWidth) < 1) {
        out.push(`${what}: stroke ${style.strokeWidth}`);
      }
      const r = element.getBoundingClientRect();
      // A line (the trail) has no height; anything else has both.
      if (r.width <= 0 || (r.height <= 0 && element.tagName !== 'line')) {
        out.push(`${what}: empty box`);
      }
      return out;
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
      message = {
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
          ...unpainted(ring, 'ring', 'stroke'),
          ...unpainted(
            plaque?.querySelector('.plaque') ?? token?.querySelector('.token-ring') ?? null,
            'body',
            plaque !== null ? 'fill' : 'stroke',
          ),
          ...unpainted(word, 'word', 'fill'),
          ...(trail === null ? [] : unpainted(trail, 'trail', 'stroke')),
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
 * the trail over any text.
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
    } else if (overlap(outer, b)) out.push(`ring × ${b.owner} ${b.what}`);
  }
  const ringZone = zoneOf(m.to);
  for (const f of frames) {
    if (f === ringZone) {
      if (!inside(outer, f, 0)) out.push(`ring leaves ${f.owner}`);
    } else if (overlap(outer, f)) out.push(`ring × ${f.owner} frame`);
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
