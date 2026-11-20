/**
 * The sequence view of a lesson (M6.2, design M6 §5): participants as lanes with lifelines, the
 * steps of the current course as rows of arrows from top to bottom. A pure function of the
 * lesson data, the defence mode, the current step and the width; it knows no DOM and no words
 * (the caller passes `say`). Units are CSS pixels: the view draws an SVG whose viewBox is exactly
 * `width × height`, so 11 here is 11 px on the screen.
 *
 * Every text of the view is JetBrains Mono, whose every character is 0.6 em wide, so the width
 * of a line is known exactly from its length (no table of advances, no estimate).
 */
import type { Say } from '../i18n/say';
import type { MessageKind, StepMode } from '../lesson/types';

/** Nothing below this width or above that one is laid out; NaN and the like get the default. */
export const MIN_WIDTH = 240;
export const MAX_WIDTH = 4000;
const DEFAULT_WIDTH = 760;
/** The most rows the view draws: the player's own limit of steps (src/core/player). */
export const MAX_ROWS = 100;
/** The most lanes: the format allows six (K19); more are drawn but share the width. */
export const MAX_LANES = 24;
/** Text past this many characters is not looked at: no label of a lesson comes near it. */
const MAX_TEXT = 400;

/** Margin of the view at the left and the right. */
export const PAD = 8;
/** Icon of a lane. */
export const ICON = { width: 44, height: 40, top: 8 } as const;
/** Lane name: bold 12 px, up to two lines. */
export const NAME_SIZE = 12;
const NAME_LINE = 15;
const NAME_LINES = 2;
/** Lane note (an address, a role): 11 px, up to two lines. */
export const NOTE_SIZE = 11;
const NOTE_LINE = 13;
const NOTE_LINES = 2;
/** Separator «Step N — title»: 11 px, up to two lines. */
export const SEPARATOR_SIZE = 11;
const SEPARATOR_LINE = 14;
const SEPARATOR_LINES = 2;
/** Label of an arrow or a note: bold 11 px, up to three lines. */
export const LABEL_SIZE = 11;
export const LABEL_LINE = 14;
const LABEL_LINES = 3;
/** Inner padding of a label box and the room its sign takes before the first line. */
export const LABEL_PAD = 4;
export const SIGN_ROOM = 16;
/** A label is never narrower than this, even over an arrow between close lanes. */
const LABEL_MIN_ROOM = 168;
/** Vertical rhythm of a row. */
const ROW_GAP = 7;
const SEPARATOR_TO_LABEL = 3;
const LABEL_TO_ARROW = 7;
const ARROW_TO_END = 8;
const BOTTOM = 10;

const charWidth = (size: number) => size * 0.6;

export type { MessageKind, StepMode };

/** The part of a participant the view needs (`SiteParticipant` fits). */
export interface LaneInput {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly icon: string;
}

/** The part of a step the view needs (`SiteStep` fits). */
export interface RowInput {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly mode: StepMode;
  readonly stopped: boolean;
  readonly message: string;
}

export interface SequenceInput {
  readonly participants: readonly LaneInput[];
  readonly steps: readonly RowInput[];
  readonly defence: boolean;
  /** The current step of the mode, from 1 (as the player says it). */
  readonly step: number;
  readonly width: number;
}

/** Text in lines with its box; `full` is all of it, for a title when the lines are `cut`. */
export interface SequenceText {
  readonly lines: readonly { readonly text: string; readonly y: number }[];
  /** Left edge of the lines (they are drawn `text-anchor: start`). */
  readonly x: number;
  readonly fontSize: number;
  readonly box: Box;
  readonly cut: boolean;
  readonly full: string;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Lane {
  readonly id: string;
  readonly icon: string;
  /** Centre of the lane. */
  readonly x: number;
  readonly iconBox: Box;
  readonly name: SequenceText;
  readonly note: SequenceText | null;
}

/** `past` has happened, `current` is the player's step, `future` is yet to come. */
export type RowState = 'past' | 'current' | 'future';
/** The colour of a row: its kind, or `stopped` (green) for a message the defence stopped. */
export type RowPaint = MessageKind | 'stopped';
/** The sign that doubles the colour (as on the scene): «!», «✓», a shield, the direction. */
export type RowSign = 'attack' | 'safe' | 'stopped' | 'right' | 'left' | 'here';

export interface Row {
  /** Step number in the mode, from 1. */
  readonly number: number;
  readonly stepId: string;
  readonly from: string;
  readonly to: string;
  /** `arrow` between two lanes; `note` on one lane (a step to itself or with a lane missing). */
  readonly shape: 'arrow' | 'note';
  readonly kind: MessageKind;
  readonly stopped: boolean;
  /** The colour once the message has arrived (a stopped one turns green there). */
  readonly paint: RowPaint;
  readonly state: RowState;
  /** The band of the row: separator, label and arrow; the hit area of its button. */
  readonly band: Box;
  readonly separator: SequenceText;
  /** Arrow: from `x1` to `x2` at `y`. A note: `x1 = x2` = its lane, `y` the middle of its box. */
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly label: SequenceText;
  /** The box drawn behind the label (padding and sign included). */
  readonly labelBox: Box;
}

export interface SequenceLayout {
  readonly width: number;
  readonly height: number;
  readonly lanes: readonly Lane[];
  /** Lifelines run from here to `height − BOTTOM`. */
  readonly lifelineTop: number;
  readonly lifelineBottom: number;
  readonly rows: readonly Row[];
  /** The current step's number in the mode, or 0 when the mode has no steps. */
  readonly current: number;
}

/** The interface strings the view uses (content/locales/<lang>/ui.md). */
export type SequenceKey = 'sequence.row';

const count = (text: string) => Array.from(text).length;
/** Characters a long word may break after. */
const BREAK_AFTER = new Set(['.', '-', '/', '_', ':', '=', '&', '?', ',', ';']);

/** Plain one-line text: no control characters, runs of white space made one space, trimmed. */
export function clean(text: unknown): string {
  if (typeof text !== 'string') return '';
  // Control characters (C0, DEL, C1) and the line and paragraph separators become spaces.
  const short = Array.from(text.slice(0, MAX_TEXT * 2))
    .slice(0, MAX_TEXT)
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      const control = code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028;
      return control || code === 0x2029 ? ' ' : c;
    })
    .join('');
  return short.replace(/\s+/g, ' ').trim();
}

/** Whether `value` is an array, without narrowing its type to `any[]`. */
const isList = (value: unknown): boolean => Array.isArray(value);

/**
 * `text` in lines of at most `perLine` characters, broken at spaces; a word longer than a line
 * is broken inside it (an address, a long token). Past `maxLines` the last line ends with «…».
 */
export function wrap(
  text: string,
  perLine: number,
  maxLines: number,
): { readonly lines: string[]; readonly cut: boolean } {
  const room = Math.max(1, Math.floor(perLine));
  const most = Math.max(1, Math.floor(maxLines));
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line !== '') lines.push(line);
    line = '';
  };
  for (const word of text.split(' ').filter((w) => w !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    if (count(joined) <= room) {
      line = joined;
      continue;
    }
    push();
    // A word longer than a line breaks after a dot, a hyphen, a slash and the like when one is
    // in the line (an address reads `bank-login.` / `example`), else where the line ends.
    let rest = Array.from(word);
    while (rest.length > room) {
      let at = room;
      for (let i = room - 1; i >= Math.ceil(room / 2); i -= 1) {
        if (BREAK_AFTER.has(rest[i] ?? '')) {
          at = i + 1;
          break;
        }
      }
      lines.push(rest.slice(0, at).join(''));
      rest = rest.slice(at);
    }
    line = rest.join('');
  }
  push();
  if (lines.length <= most) return { lines, cut: false };
  const kept = lines.slice(0, most);
  const last = Array.from(kept[most - 1] ?? '');
  kept[most - 1] = `${last.slice(0, Math.max(0, room - 1)).join('')}…`;
  return { lines: kept, cut: true };
}

/** Lines of `full` laid out from `top`, starting at `x`, in a room `room` px wide. */
function textAt(
  full: string,
  x: number,
  top: number,
  room: number,
  size: number,
  lineHeight: number,
  maxLines: number,
): SequenceText {
  const per = Math.floor(room / charWidth(size) + 1e-9);
  const wrapped = wrap(full, per, maxLines);
  const lines = wrapped.lines.map((text, i) => ({
    text,
    // Baseline: the cap height of the font sits in the line, 0.8 em under its top.
    y: top + i * lineHeight + size * 0.8,
  }));
  const widest = Math.max(0, ...wrapped.lines.map((l) => count(l) * charWidth(size)));
  const height = lines.length === 0 ? 0 : (lines.length - 1) * lineHeight + size * 1.05;
  return {
    lines,
    x,
    fontSize: size,
    box: { x, y: top, width: widest, height },
    cut: wrapped.cut,
    full,
  };
}

/** Centred text: the same lines, each line's own left edge is not needed (mono, centred box). */
function centred(
  full: string,
  cx: number,
  top: number,
  room: number,
  size: number,
  lineHeight: number,
  maxLines: number,
): SequenceText {
  const laid = textAt(full, 0, top, room, size, lineHeight, maxLines);
  const x = cx - laid.box.width / 2;
  return { ...laid, x, box: { ...laid.box, x } };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Steps of one mode in lesson order (K20): shared steps and the steps of that mode. */
function inMode<T extends { readonly mode: StepMode }>(steps: readonly T[], defence: boolean): T[] {
  const own: StepMode = defence ? 'with-defence' : 'without-defence';
  return steps.filter((s) => s.mode === 'both' || s.mode === own);
}

/** The current step in a mode of `n` steps: a whole number from 1 to n, 0 when there are none. */
export function currentNumber(wanted: number, n: number): number {
  if (n <= 0) return 0;
  const whole = Number.isFinite(wanted) ? Math.floor(wanted) : wanted > 0 ? n : 1;
  return Math.min(n, Math.max(1, whole));
}

/** The sign of a row as drawn when its message has `arrived` (or not yet). */
export function rowSign(
  row: Pick<Row, 'kind' | 'stopped' | 'shape' | 'x1' | 'x2'>,
  arrived: boolean,
): RowSign {
  if (row.stopped && arrived) return 'stopped';
  if (row.kind === 'attack') return 'attack';
  if (row.kind === 'safe') return 'safe';
  if (row.shape === 'note') return 'here';
  return row.x2 >= row.x1 ? 'right' : 'left';
}

/** The colour of a row as drawn: a stopped message is its kind on the way, green on arrival. */
export function rowPaint(row: Pick<Row, 'kind' | 'stopped'>, arrived: boolean): RowPaint {
  return row.stopped && arrived ? 'stopped' : row.kind;
}

export function layoutSequence(input: SequenceInput, say: Say<SequenceKey>): SequenceLayout {
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, finite(input.width, DEFAULT_WIDTH)));
  const inner = width - 2 * PAD;

  // Lanes: one per participant in scene order, the first of a repeated id wins.
  const seen = new Set<string>();
  const people = (isList(input.participants) ? input.participants : [])
    .filter((p) => {
      if (typeof p.id !== 'string' || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, MAX_LANES);
  const column = people.length === 0 ? inner : inner / people.length;
  const textRoom = Math.max(charWidth(NAME_SIZE), column - 6);
  const iconWidth = Math.max(4, Math.min(ICON.width, column - 4));
  const iconHeight = (ICON.height * iconWidth) / ICON.width;
  const nameTop = ICON.top + ICON.height + 4;
  const lanes: Lane[] = people.map((p, i) => {
    const x = PAD + column * (i + 0.5);
    const name = centred(clean(p.name), x, nameTop, textRoom, NAME_SIZE, NAME_LINE, NAME_LINES);
    const noteText = clean(p.note);
    const noteTop = name.box.y + name.box.height + 3;
    const note =
      noteText === ''
        ? null
        : centred(noteText, x, noteTop, textRoom, NOTE_SIZE, NOTE_LINE, NOTE_LINES);
    return {
      id: p.id,
      icon: typeof p.icon === 'string' ? p.icon : '',
      x,
      // An icon never wider than its column (more lanes than the format allows share it).
      iconBox: { x: x - iconWidth / 2, y: ICON.top, width: iconWidth, height: iconHeight },
      name,
      note,
    };
  });
  const headBottom = Math.max(
    nameTop + NAME_SIZE,
    ...lanes.map((l) => {
      const last = l.note ?? l.name;
      return last.box.y + last.box.height;
    }),
  );
  const lifelineTop = headBottom + 6;
  const laneOf = new Map(lanes.map((l) => [l.id, l]));

  const steps = inMode(isList(input.steps) ? input.steps : [], input.defence).slice(0, MAX_ROWS);
  const current = currentNumber(finite(input.step, 1), steps.length);

  let y = lifelineTop + 4;
  const rows: Row[] = steps.map((step, i) => {
    const number = i + 1;
    const top = y;
    const separator = textAt(
      clean(say('sequence.row', { number, title: clean(step.title) })),
      PAD + 6,
      top + ROW_GAP,
      inner - 12,
      SEPARATOR_SIZE,
      SEPARATOR_LINE,
      SEPARATOR_LINES,
    );
    const labelTop = separator.box.y + separator.box.height + SEPARATOR_TO_LABEL;
    const from = laneOf.get(step.from);
    const to = laneOf.get(step.to);
    const arrow = from !== undefined && to !== undefined && from.id !== to.id;
    const at = from ?? to;
    const x1 = arrow ? from.x : (at?.x ?? PAD + inner / 2);
    const x2 = arrow ? to.x : x1;
    // The label takes the room over its arrow, or at least LABEL_MIN_ROOM (never more than the
    // view), centred on the arrow or the lane and moved just enough to stay inside the view.
    const span = Math.abs(x2 - x1);
    const outer = Math.min(inner, Math.max(span - 8, Math.min(LABEL_MIN_ROOM, inner)));
    const textRoom = outer - 2 * LABEL_PAD - SIGN_ROOM;
    const message = clean(step.message);
    const laid = textAt(
      message,
      0,
      labelTop + LABEL_PAD,
      textRoom,
      LABEL_SIZE,
      LABEL_LINE,
      LABEL_LINES,
    );
    const boxWidth =
      Math.max(SIGN_ROOM, laid.box.width) + 2 * LABEL_PAD + (laid.lines.length > 0 ? SIGN_ROOM : 0);
    const boxHeight = Math.max(LABEL_LINE, laid.box.height) + 2 * LABEL_PAD;
    const middle = (x1 + x2) / 2;
    const boxX = Math.min(PAD + inner - boxWidth, Math.max(PAD, middle - boxWidth / 2));
    const labelBox = { x: boxX, y: labelTop, width: boxWidth, height: boxHeight };
    const textX = boxX + LABEL_PAD + SIGN_ROOM;
    const label: SequenceText = {
      ...laid,
      x: textX,
      box: { ...laid.box, x: textX },
    };
    // An arrow runs under its label; a note is its label box on the lane.
    const lineY = arrow ? labelTop + boxHeight + LABEL_TO_ARROW : labelTop + boxHeight / 2;
    const bottom = arrow ? lineY + ARROW_TO_END : labelTop + boxHeight + ARROW_TO_END;
    y = bottom;
    const state: RowState = number < current ? 'past' : number === current ? 'current' : 'future';
    const stopped = step.stopped;
    return {
      number,
      stepId: typeof step.id === 'string' ? step.id : '',
      from: typeof step.from === 'string' ? step.from : '',
      to: typeof step.to === 'string' ? step.to : '',
      shape: arrow ? 'arrow' : 'note',
      kind: step.kind,
      stopped,
      paint: rowPaint({ kind: step.kind, stopped }, true),
      state,
      band: { x: PAD / 2, y: top, width: width - PAD, height: bottom - top },
      separator,
      x1,
      x2,
      y: lineY,
      label,
      labelBox,
    };
  });

  const lifelineBottom = Math.max(lifelineTop + 24, y + 4);
  return {
    width,
    height: lifelineBottom + BOTTOM,
    lanes,
    lifelineTop,
    lifelineBottom,
    rows,
    current,
  };
}
