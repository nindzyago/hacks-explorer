/**
 * Where everything of a lesson scene stands (design M1.2 E1, K19, K45): a pure function of the
 * participants, the zones and the scene width. Units are CSS pixels; the scene draws an SVG
 * whose viewBox is exactly `width × height`, so 11 here is 11 px on the screen.
 *
 * Text width is estimated, not measured (the core has no DOM): a character of JetBrains Mono
 * is 0.6 em; bold Onest (names) goes by a small table of its advances, rounded up (M1.2d), so
 * the estimate errs on the wide side. The e2e test checks the real boxes.
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
  /**
   * The line goes on with the word of the line before it, with no space between (an address
   * broken after a dot, M1.2d): the scene joins them so the text reads as one word.
   */
  readonly glued: boolean;
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
 * Room between the column frame and its text, at each side (M1.2c, M1.2d): the zone frame's
 * line (0.75 px in), 2.25 px of paper, the ring's line (3…5 px in) and 2 px of paper.
 */
const TEXT_INSET = 8;
/**
 * A name keeps 1 px more at each side (CI4): at 11-13 px Chromium on Linux draws bold Onest up
 * to 0.85 px past the advance of its last letter (macOS draws it inside), so a name as wide as
 * the line came 1.3-1.5 px from the ring there.
 */
const NAME_INK = 1;
/**
 * Where the middle of the ring's line stands inside the column frame (M1.2d: 4.5, was 2.5),
 * rounded to whole pixels so the 2 px line is drawn sharp: the ring keeps at least 2.25 px of
 * paper from the zone frame's line, so that a red ring inside the red «Подделка» frame reads
 * as a line of its own, and at least 2 px from the text.
 */
const RING_INSET = 4.5;
/**
 * The lane lies this far below the zone labels (M1.2b: 38; M1.2d: 50): the word over a message
 * (11 px over a 21 px token) keeps 15 px of paper from the label above it, so it does not read
 * as the label's second line.
 */
const LANE_BELOW_LABELS = 50;
/**
 * The icons start this far below the lane (M1.2b: 16; M1.2d: 30): the tallest message at rest
 * — a three-line plaque, 42 px and its 3 px shadow, or a token — ends above the receiver's
 * ring and covers no icon.
 */
const ICON_BELOW_LANE = 30;
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

/** The two scene fonts: JetBrains Mono (notes, zone labels) and bold Onest (names). */
export type SceneFont = 'mono' | 'sans';

// Bold Onest: the advance of each letter in em, measured in Chromium at 100 px (the same on
// macOS and on Linux without hinting, K117) and rounded up to 0.01 (CI4). The mono font is
// 0.6 em for every character. M1.2d had a table of five classes; it was up to 17% too wide
// («ы» 0.87 for 0.745), so a word that fits was taken as too wide and drawn *wider* to the
// line by `textLength` (F1 «данных», 40.4 px stretched to 43.2), and a few letters were
// narrower than real («д», «т», «Д», digits).
const SANS_ADVANCES: ReadonlyArray<readonly [number, string]> = [
  [0.26, 'il'],
  [0.29, 'j.:'],
  [0.3, " I'|"],
  [0.31, ',;!'],
  [0.36, '()'],
  [0.39, 'f1'],
  [0.4, 'r'],
  [0.42, 't'],
  [0.45, 'г'],
  [0.47, '-'],
  [0.5, '"'],
  [0.51, 'z'],
  [0.52, 's'],
  [0.53, 'т'],
  [0.54, 'з7'],
  [0.55, 'чь'],
  [0.56, 'хэkvx'],
  [0.57, 'авa'],
  [0.58, 'еёклсуяce2'],
  [0.59, 'нпГuJ'],
  [0.6, 'оъoL'],
  [0.61, 'цhnF'],
  [0.62, 'бийрТyZ35'],
  [0.63, 'ЕЁbdgpqE689'],
  [0.64, 'T'],
  [0.66, 'РP04'],
  [0.67, 'дЗУХЬSX'],
  [0.68, 'БВКBK'],
  [0.69, 'ЧRY'],
  [0.71, 'ЛЯ'],
  [0.72, 'ЭV'],
  [0.73, 'мАСACD'],
  [0.74, 'ПU'],
  [0.75, 'ыНЦGH'],
  [0.76, 'ИЙЪ'],
  [0.77, 'N'],
  [0.78, 'фО'],
  [0.79, 'ДOQ'],
  [0.81, 'ж'],
  [0.82, 'ю'],
  [0.84, 'ш'],
  [0.86, 'щm'],
  [0.87, 'w'],
  [0.88, 'Ф'],
  [0.9, 'ЫM'],
  [0.91, 'М'],
  [0.95, 'Ж'],
  [1.0, 'Ш'],
  [1.01, 'W'],
  [1.02, 'ЩЮ'],
];
const SANS_EM = new Map(SANS_ADVANCES.flatMap(([em, cs]) => Array.from(cs, (c) => [c, em])));
/** Not in the table (another script, a symbol): as wide as the wide letters, to err wide. */
const SANS_UNKNOWN_EM = 0.87;
function sansEm(c: string): number {
  return SANS_EM.get(c) ?? SANS_UNKNOWN_EM;
}

/** Estimated width of `text` in px: font size, letter spacing and the font's advances. */
export function textWidth(text: string, fontSize: number, spacing = 0, font: SceneFont = 'mono') {
  let em = 0;
  for (const c of chars(text)) em += font === 'mono' ? CHAR_EM : sansEm(c);
  return em * fontSize + chars(text).length * spacing;
}

/** How a block measures its text: one function of a string, in px. */
type Measure = (text: string) => number;

/** The longest start of `letters` that, with «…» after it, is at most `max` px wide. */
function prefixWithin(letters: readonly string[], max: number, measure: Measure): string {
  let n = letters.length;
  while (n > 0 && measure(`${letters.slice(0, n).join('')}…`) > max) n -= 1;
  return `${letters.slice(0, n).join('')}…`;
}

/**
 * An address (M1.2d): an IP address or a domain name — letters, digits and hyphens in parts
 * joined by dots or colons, starting and ending with a letter or digit (`203.0.113.66`,
 * `bank-login.example`, `2001:db8::1`). `параметр:` or `конец.` is a word, not an address.
 */
const ADDRESS = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]|[.:]+(?=[\p{L}\p{N}]))*[\p{L}\p{N}]$/u;
export function isAddress(word: string): boolean {
  return /[.:]/.test(word) && ADDRESS.test(word);
}

/**
 * An address too long for one line, in the fewest lines of at most `max` px, broken only
 * after a dot, colon or hyphen, with the longest line as short as it can be (M1.2d: never
 * «20…0.113.66»). A part wider than a line on its own loses its end to «…»: the last resort on
 * a scene far narrower than a phone.
 */
function breakAddress(word: string, max: number, measure: Measure) {
  const parts = word.match(/[^.:-]*(?:[.:-]+|$)/g)?.filter((p) => p !== '') ?? [word];
  let cut = false;
  const pieces = parts.map((p) => {
    if (measure(p) <= max) return p;
    cut = true;
    return prefixWithin(chars(p), max, measure);
  });
  const n = pieces.length;
  const width = (from: number, to: number) => measure(pieces.slice(from, to).join(''));
  // best[k][i]: the widest line when the first i pieces make k lines; start[k][i]: where the
  // last of those lines starts.
  const best: number[][] = [[0, ...pieces.map(() => Infinity)]];
  const start: number[][] = [[]];
  for (let k = 1; k <= n; k += 1) {
    const row = [Infinity];
    const back = [0];
    for (let i = 1; i <= n; i += 1) {
      let least = Infinity;
      let at = 0;
      for (let j = k - 1; j < i; j += 1) {
        const line = width(j, i);
        if (line > max) continue;
        const worst = Math.max(best[k - 1]?.[j] ?? Infinity, line);
        if (worst < least) {
          least = worst;
          at = j;
        }
      }
      row.push(least);
      back.push(at);
    }
    best.push(row);
    start.push(back);
    if ((row[n] ?? Infinity) < Infinity) {
      const lines: string[] = [];
      let end = n;
      for (let line = k; line > 0; line -= 1) {
        const from = start[line]?.[end] ?? 0;
        lines.unshift(pieces.slice(from, end).join(''));
        end = from;
      }
      return { lines, cut };
    }
  }
  return { lines: pieces, cut };
}

/**
 * Greedy line breaking at spaces only, by the estimated width of `font`; at most `MAX_LINES`,
 * the last cut with «…» when the text is longer. A word alone on its line may be drawn down to
 * 85% of its width (M1.2b); a word wider still gets a line of its own, its end cut with «…»,
 * but an address breaks after a dot instead (M1.2d), its lines after the first marked `glued`.
 */
export function wrap(
  text: string,
  maxWidth: number,
  fontSize: number,
  spacing: number,
  maxLines = MAX_LINES,
  font: SceneFont = 'mono',
): { lines: string[]; glued: boolean[]; cut: boolean } {
  const measure: Measure = (s) => textWidth(s, fontSize, spacing, font);
  const squeezed = maxWidth / MIN_SQUEEZE;
  const lines: string[] = [];
  const glued: boolean[] = [];
  let line = '';
  let shortened = false;
  const add = (t: string, joined = false) => {
    lines.push(t);
    glued.push(joined);
  };
  const push = () => {
    if (line !== '') add(line);
    line = '';
  };
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    if (measure(joined) <= maxWidth) {
      line = joined;
      continue;
    }
    push();
    if (measure(word) <= maxWidth) line = word;
    else if (measure(word) <= squeezed) add(word);
    else if (isAddress(word)) {
      const broken = breakAddress(word, squeezed, measure);
      broken.lines.forEach((l, i) => {
        add(l, i > 0);
      });
      shortened ||= broken.cut;
    } else {
      add(prefixWithin(chars(word), squeezed, measure));
      shortened = true;
    }
  }
  push();
  if (lines.length <= maxLines) return { lines, glued, cut: shortened };
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = prefixWithin(chars(kept[maxLines - 1] ?? ''), maxWidth, measure);
  return { lines: kept, glued: glued.slice(0, maxLines), cut: true };
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
    font?: SceneFont;
  },
): TextBlock {
  const { anchor, x, firstBaseline, maxWidth, fontSize, lineHeight } = options;
  const spacing = options.spacing ?? 0;
  const font = options.font ?? 'mono';
  const { lines, glued, cut } = wrap(text, maxWidth, fontSize, spacing, MAX_LINES, font);
  const measure = (t: string) => textWidth(t, fontSize, spacing, font);
  const width = Math.min(maxWidth, Math.max(0, ...lines.map(measure)));
  const top = firstBaseline - fontSize * 0.8;
  const height = (lines.length - 1) * lineHeight + fontSize * 1.05;
  return {
    anchor,
    x,
    fontSize,
    lines: lines.map((t, i) => ({
      text: t,
      y: firstBaseline + i * lineHeight,
      fit: measure(t) > maxWidth ? maxWidth : null,
      glued: glued[i] ?? false,
    })),
    box: { x: anchor === 'middle' ? x - width / 2 : x, y: top, width, height },
    cut,
  };
}

/** Name size: 13 px on a roomy column, 12 on a tight one, 11 when a word would not fit. */
function nameSize(name: string, column: number, maxWidth: number): number {
  const start = column >= 140 ? 13 : 12;
  const words = name.split(/\s+/);
  for (let size = start; size > MIN_FONT_SIZE; size -= 1) {
    if (words.every((w) => textWidth(w, size, 0, 'sans') <= maxWidth)) return size;
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
  const laneY = labelBottom + LANE_BELOW_LABELS;
  const iconWidth = Math.min(MAX_ICON_WIDTH, Math.max(0, 2 * half - 16));
  const iconHeight = iconWidth * ICON_ASPECT;
  const iconTop = laneY + ICON_BELOW_LANE;
  // Text may use the whole frame of the column but TEXT_INSET at each side, where the ring
  // runs (M1.2c, M1.2d); an address too long for a phone column breaks after a dot.
  const textWidthMax = Math.max(0, 2 * half - 2 * TEXT_INSET);
  const nameWidthMax = Math.max(0, textWidthMax - 2 * NAME_INK);

  const participants = input.participants.map((p, i): ParticipantLayout => {
    const x = cx(i);
    const icon = { x: x - iconWidth / 2, y: iconTop, width: iconWidth, height: iconHeight };
    const size = nameSize(p.name, column, nameWidthMax);
    const name = block(p.name, {
      anchor: 'middle',
      x,
      firstBaseline: bottom(icon) + 18,
      maxWidth: nameWidthMax,
      fontSize: size,
      lineHeight: Math.round(size * 1.25),
      font: 'sans',
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
    // The ring's line keeps 2 px of paper from the icon and the text (M1.2d).
    const left = Math.round(x - half + RING_INSET);
    const top = Math.round(iconTop - 4);
    const area = {
      x: left,
      y: top,
      width: Math.round(x + half - RING_INSET) - left,
      height: Math.round(bottom(last.box) + 4) - top,
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
