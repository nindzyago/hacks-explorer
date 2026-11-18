/**
 * Where everything of a lesson scene stands (design M1.2 E1, K19, K45): a pure function of the
 * participants, the zones and the scene width. Units are CSS pixels; the scene draws an SVG
 * whose viewBox is exactly `width × height`, so 11 here is 11 px on the screen.
 *
 * Text width is estimated, not measured (the core has no DOM): a character of the scene fonts
 * is taken as 0.6 em wide, which is the advance of JetBrains Mono and a little over the average
 * of bold Onest, so the estimate errs on the wide side. The e2e test checks the real boxes.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextLine {
  readonly text: string;
  /** Baseline. */
  readonly y: number;
  /**
   * A word a little too wide for the line is drawn narrower to this width (SVG `textLength`)
   * instead of breaking inside it (M1.2b); null when the line fits as it is.
   */
  readonly fit: number | null;
}

export interface TextBlock {
  /** `middle`: lines are centred on `x`; `start`: lines begin at `x`. */
  readonly anchor: 'middle' | 'start';
  readonly x: number;
  readonly fontSize: number;
  readonly lines: readonly TextLine[];
  /** The space the lines take, by the estimate. */
  readonly box: Rect;
  /** True when the text did not fit and the last line ends with «…». */
  readonly cut: boolean;
}

export interface ParticipantLayout {
  readonly id: string;
  /** Centre of the participant's column. */
  readonly cx: number;
  readonly icon: Rect;
  readonly name: TextBlock;
  readonly note: TextBlock | null;
  /**
   * The area of the participant: icon and labels, for a hit target. The receiver ring is drawn
   * on its edge with a `RING_STROKE` line, which stays clear of the text and of the zone frame
   * (M1.2c).
   */
  readonly area: Rect;
  /** The edges of the participant's own frame (its column less the gap to a neighbour zone). */
  readonly span: { readonly x1: number; readonly x2: number };
}

export interface ZoneLayout {
  readonly id: string;
  readonly danger: boolean;
  /** The members the scene has, in lesson order. */
  readonly members: readonly string[];
  readonly rect: Rect;
  readonly label: TextBlock;
}

export interface SceneLayout {
  readonly width: number;
  readonly height: number;
  /** The line messages travel along (M1.2b), above the icons. */
  readonly lane: { readonly x1: number; readonly x2: number; readonly y: number };
  readonly participants: readonly ParticipantLayout[];
  readonly zones: readonly ZoneLayout[];
}

export interface SceneInput {
  readonly participants: readonly {
    readonly id: string;
    readonly name: string;
    readonly note: string;
  }[];
  readonly zones: readonly {
    readonly id: string;
    readonly label: string;
    readonly members: readonly string[];
    readonly danger: boolean;
  }[];
}

/** The smallest text of the scene, in px (design M1.2 §5 «Телефон»). */
export const MIN_FONT_SIZE = 11;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 1600;
/** Icons are cut 310 × 275 from the sheets (K42); drawn at most 150 px wide, as in the prototype. */
export const ICON_ASPECT = 275 / 310;
export const MAX_ICON_WIDTH = 150;

const PAD = 4;
/** Half width of a zone around one participant, at most (the prototype: 85). */
const MAX_HALF = 85;
/** The least space between two neighbouring zones (M1.2c: 6, for a wider phone column). */
const ZONE_GAP = 6;
/** Width of the receiver ring's line (M1.2c). */
export const RING_STROKE = 2;
/**
 * Room between the column frame and its text, at each side (M1.2c): the zone frame's line
 * (0.75 px in), the ring's line (1.5…3.5 px in) and 1 px of air.
 */
const TEXT_INSET = 4.5;
/** Where the middle of the ring's line stands inside the column frame. */
const RING_INSET = 2.5;
const CHAR_EM = 0.6;
const ZONE_LABEL_SIZE = 11;
const ZONE_LABEL_SPACING = 1;
const ZONE_LABEL_LINE = 14;
const NOTE_SIZE = 11;
const NOTE_LINE = 14;
const MAX_LINES = 3;
/** A long word may be drawn down to 85% of its width rather than cut (M1.2b). */
export const MIN_SQUEEZE = 0.85;

function clampWidth(width: number): number {
  if (Number.isNaN(width)) return MIN_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

/**
 * Characters as code points. A lesson name is plain text; a joined emoji would count as several
 * characters, which only makes the width estimate wider (safe).
 */
function chars(text: string): string[] {
  return Array.from(text);
}

export function textWidth(text: string, fontSize: number, spacing = 0): number {
  return chars(text).length * (fontSize * CHAR_EM + spacing);
}

/**
 * A word wider than the line, shortened with «…» (M1.2b: a word never breaks inside). An
 * address (`bank-login.example`, `203.0.113.66`) keeps its end after the first dot, where the
 * zone is, and loses its middle; any other word keeps its start.
 */
function shorten(word: string[], maxChars: number): string {
  if (maxChars <= 1) return '…';
  const dot = word.indexOf('.');
  const tail = dot > 0 ? word.slice(dot + 1) : [];
  if (tail.length > 0 && tail.length <= maxChars - 2) {
    return `${word.slice(0, maxChars - 1 - tail.length).join('')}…${tail.join('')}`;
  }
  return `${word.slice(0, maxChars - 1).join('')}…`;
}

/**
 * Greedy line breaking at spaces only; at most `MAX_LINES`, the last cut with «…» when the text
 * is longer. A word longer than a line gets a line of its own, shortened with «…».
 */
export function wrap(
  text: string,
  maxWidth: number,
  fontSize: number,
  spacing: number,
  maxLines = MAX_LINES,
  squeezeJoined = false,
): { lines: string[]; cut: boolean } {
  const perChar = fontSize * CHAR_EM + spacing;
  const maxChars = Math.max(1, Math.floor(maxWidth / perChar));
  // A word alone on its line may be drawn narrower, down to MIN_SQUEEZE of its width.
  const squeezedChars = Math.max(maxChars, Math.floor(maxWidth / (perChar * MIN_SQUEEZE)));
  const lines: string[] = [];
  let line = '';
  let shortened = false;
  const push = () => {
    if (line !== '') lines.push(line);
    line = '';
  };
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    // A plaque (M1.2c) may draw a line of several words narrower too; names and notes may not.
    if (chars(joined).length <= (squeezeJoined && line !== '' ? squeezedChars : maxChars)) {
      line = joined;
      continue;
    }
    push();
    const letters = chars(word);
    if (letters.length <= maxChars) line = word;
    else if (letters.length <= squeezedChars) lines.push(word);
    else {
      lines.push(shorten(letters, squeezedChars));
      shortened = true;
    }
  }
  push();
  if (lines.length <= maxLines) return { lines, cut: shortened };
  const kept = lines.slice(0, maxLines);
  const last = chars(kept[maxLines - 1] ?? '');
  kept[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1)).join('')}…`;
  return { lines: kept, cut: true };
}

function block(
  text: string,
  options: {
    anchor: 'middle' | 'start';
    x: number;
    firstBaseline: number;
    maxWidth: number;
    fontSize: number;
    lineHeight: number;
    spacing?: number;
  },
): TextBlock {
  const { anchor, x, firstBaseline, maxWidth, fontSize, lineHeight } = options;
  const spacing = options.spacing ?? 0;
  const { lines, cut } = wrap(text, maxWidth, fontSize, spacing);
  const width = Math.min(
    maxWidth,
    Math.max(0, ...lines.map((l) => textWidth(l, fontSize, spacing))),
  );
  const top = firstBaseline - fontSize * 0.8;
  const height = (lines.length - 1) * lineHeight + fontSize * 1.05;
  return {
    anchor,
    x,
    fontSize,
    lines: lines.map((t, i) => ({
      text: t,
      y: firstBaseline + i * lineHeight,
      fit: textWidth(t, fontSize, spacing) > maxWidth ? maxWidth : null,
    })),
    box: { x: anchor === 'middle' ? x - width / 2 : x, y: top, width, height },
    cut,
  };
}

/** Name size: 13 px on a roomy column, 12 on a tight one, 11 when a word would not fit. */
function nameSize(name: string, column: number, maxWidth: number): number {
  const start = column >= 140 ? 13 : 12;
  const longest = Math.max(0, ...name.split(/\s+/).map((w) => chars(w).length));
  for (let size = start; size > MIN_FONT_SIZE; size -= 1) {
    if (longest * size * CHAR_EM <= maxWidth) return size;
  }
  return MIN_FONT_SIZE;
}

const bottom = (r: Rect) => r.y + r.height;

export function layoutScene(input: SceneInput & { readonly width: number }): SceneLayout {
  const width = clampWidth(input.width);
  const n = input.participants.length;
  const column = n === 0 ? width - 2 * PAD : (width - 2 * PAD) / n;
  const half = Math.min(MAX_HALF, column / 2 - ZONE_GAP / 2);
  const cx = (i: number) => PAD + (i + 0.5) * column;
  const index = new Map(input.participants.map((p, i) => [p.id, i]));

  // Zones: the span of their members; a zone with no known member is not drawn.
  const zoneTop = PAD;
  const spans = input.zones.flatMap((z) => {
    const at = z.members.map((m) => index.get(m)).filter((i) => i !== undefined);
    if (at.length === 0) return [];
    const x = cx(Math.min(...at)) - half;
    return [{ zone: z, x, width: cx(Math.max(...at)) + half - x }];
  });
  const labels = spans.map(({ zone, x, width: w }) => {
    const inset = Math.min(10, w * 0.08);
    return block(zone.label, {
      anchor: 'start',
      x: x + inset,
      firstBaseline: zoneTop + 8 + ZONE_LABEL_SIZE,
      maxWidth: w - 2 * inset,
      fontSize: ZONE_LABEL_SIZE,
      lineHeight: ZONE_LABEL_LINE,
      spacing: ZONE_LABEL_SPACING,
    });
  });
  const labelBottom = Math.max(zoneTop + 8 + ZONE_LABEL_SIZE, ...labels.map((l) => bottom(l.box)));

  // Room above the lane for the word over a message (M1.2b): 11 px text over a 21 px token.
  const laneY = labelBottom + 38;
  const iconWidth = Math.min(MAX_ICON_WIDTH, Math.max(0, 2 * half - 16));
  const iconHeight = iconWidth * ICON_ASPECT;
  const iconTop = laneY + 16;
  // Text may use the whole frame of the column but TEXT_INSET at each side, where the ring
  // runs (M1.2c); an address of 12 characters still fits a phone column of four participants.
  const textWidthMax = Math.max(0, 2 * half - 2 * TEXT_INSET);

  const participants = input.participants.map((p, i): ParticipantLayout => {
    const x = cx(i);
    const icon = { x: x - iconWidth / 2, y: iconTop, width: iconWidth, height: iconHeight };
    const size = nameSize(p.name, column, textWidthMax);
    const name = block(p.name, {
      anchor: 'middle',
      x,
      firstBaseline: bottom(icon) + 18,
      maxWidth: textWidthMax,
      fontSize: size,
      lineHeight: Math.round(size * 1.25),
    });
    const note =
      p.note.trim() === ''
        ? null
        : block(p.note, {
            anchor: 'middle',
            x,
            firstBaseline: (name.lines.at(-1)?.y ?? bottom(icon)) + 4 + NOTE_LINE,
            maxWidth: textWidthMax,
            fontSize: NOTE_SIZE,
            lineHeight: NOTE_LINE,
          });
    const last = note ?? name;
    const area = {
      x: x - half + RING_INSET,
      y: iconTop - 2,
      width: 2 * half - 2 * RING_INSET,
      height: bottom(last.box) - iconTop + 6,
    };
    return { id: p.id, cx: x, icon, name, note, area, span: { x1: x - half, x2: x + half } };
  });

  const contentBottom = Math.max(iconTop + iconHeight, ...participants.map((p) => bottom(p.area)));
  const zoneBottom = contentBottom + 10;
  const zones = spans.map(({ zone, x, width: w }, i): ZoneLayout => {
    const label = labels[i];
    if (label === undefined) throw new Error('unreachable: one label per zone');
    return {
      id: zone.id,
      danger: zone.danger,
      members: zone.members.filter((m) => index.has(m)),
      rect: { x, y: zoneTop, width: w, height: zoneBottom - zoneTop },
      label,
    };
  });

  return {
    width,
    height: zoneBottom + PAD,
    lane: { x1: n === 0 ? width / 2 : cx(0), x2: n === 0 ? width / 2 : cx(n - 1), y: laneY },
    participants,
    zones,
  };
}
