/**
 * The message of the current step (design M1.2 E2, E8, D3 a / K44): which step is current in a
 * mode, and where its message stands at a moment of the player clock. Pure: the same step,
 * scene and elapsed time always give the same answer, so a screenshot repeats byte for byte.
 */
import type { Say } from '../i18n/say';
import type { MessageKind, StepMode } from '../lesson/types';
import { MIN_SQUEEZE, type Rect, type SceneLayout } from './layout';

/** How long a message travels from sender to receiver, in player clock milliseconds. */
export const TRAVEL_MS = 900;
/** Plaque height and radius of an icon token, in px (as in the prototype). */
export const MESSAGE_HEIGHT = 24;
export const TOKEN_RADIUS = 21;
/** Plaque text: JetBrains Mono 11 px bold; 0.6 em a character. */
export const MESSAGE_FONT_SIZE = 11;
const CHAR_WIDTH = MESSAGE_FONT_SIZE * 0.6;
/** Padding at each end of a plaque and the room the sign takes before the text. */
const PLAQUE_PAD = 9;
const SIGN_ROOM = 16;
/**
 * A compact plaque (M1.2c, M1.2d), for a column too narrow for the one-line plaque: 3 px, the
 * sign in 11…16 px before the first line only, the text in up to three lines — the second and
 * third start under the sign — and 3 px.
 */
const COMPACT_PAD = 3;
const COMPACT_SIGN = 11;
const COMPACT_END = 3;
const COMPACT_LINES = 3;
/** Heights of a two- and three-line plaque and the baselines of its lines, from its middle. */
export const MESSAGE_HEIGHT_2 = 30;
export const MESSAGE_HEIGHT_3 = 42;
const LINE_BASELINES: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [4],
  2: [-3, 10],
  3: [-9, 4, 17],
};
const HEIGHTS: Readonly<Record<1 | 2 | 3, number>> = {
  1: MESSAGE_HEIGHT,
  2: MESSAGE_HEIGHT_2,
  3: MESSAGE_HEIGHT_3,
};
/** The plaque's shadow lies this far right and down. */
const PLAQUE_SHADOW = 3;
/** The word over the message: letter spacing of 0.5 px (Scene.svelte). */
export const WORD_SPACING = 0.5;
const EDGE = 4;

export type { MessageKind, StepMode };

/** The part of a lesson step the scene needs (`SiteStep` fits). */
export interface StepInput {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly mode: StepMode;
  readonly stopped: boolean;
  readonly icon: string | null;
  readonly message: string;
}

/**
 * The sign that doubles the colour: «!» for attack, «✓» for safe, a shield for a stopped
 * message, the direction for a legit one (`here` when it does not move).
 */
export type MessageSign = 'attack' | 'safe' | 'stopped' | 'right' | 'left' | 'here';

/**
 * The colour a message is painted with (M1.2d, K62): its kind, or the defence colour once a
 * stopped message has stopped. Plaque or token, sign badge, word and receiver ring take it.
 */
export type MessagePaint = MessageKind | 'stopped';

export interface MessageLayout {
  readonly kind: MessageKind;
  readonly stopped: boolean;
  /** Plaque, word and ring: the kind, `stopped` (green) where a stopped message stops. */
  readonly paint: MessagePaint;
  /** The trail always shows the kind of the message that came. */
  readonly trailPaint: MessageKind;
  readonly sign: MessageSign;
  /** The word that doubles the colour, shown above the message. */
  readonly word: string;
  /** Baseline of the word. */
  readonly wordY: number;
  /** Centre of the plaque or the token. */
  readonly x: number;
  readonly y: number;
  /** 0…1 along the path, eased. */
  readonly progress: number;
  readonly arrived: boolean;
  /** The line behind the message, from the sender; null when it has not moved. */
  readonly trail: { readonly x1: number; readonly x2: number; readonly y: number } | null;
  /** The frame around the receiver. */
  readonly ring: Rect;
  readonly plaque: PlaqueLayout | null;
  readonly token: { readonly icon: string; readonly radius: number } | null;
  /** The word drawn narrower to this width (SVG `textLength`, M1.2c); null as it is. */
  readonly wordFit: number | null;
  /** What the plaque or token takes with its shadow and badge, in scene coordinates. */
  readonly body: Rect;
  /** What the word takes, in scene coordinates. */
  readonly wordBox: Rect;
}

export interface PlaqueLayout {
  readonly width: number;
  readonly height: number;
  /** All of the text as drawn, lines joined by a space. */
  readonly text: string;
  /**
   * Lines with their baselines from the middle of the plaque, where they start from the
   * plaque's left edge and an optional `textLength`.
   */
  readonly lines: readonly {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly fit: number | null;
  }[];
  /** The text did not fit and ends with «…». */
  readonly cut: boolean;
  /** Where the sign's middle stands (from the left edge and the middle) and the first line starts. */
  readonly signX: number;
  readonly signY: number;
  readonly textX: number;
}

/** The interface strings (content/locales/<lang>/ui.md) of the marks of a message (M2.3). */
export type MarkKey = 'mark.legit' | 'mark.attack' | 'mark.safe' | 'mark.stopped' | 'mark.moving';

const MARK_KEYS: Readonly<Record<MessageKind, MarkKey>> = {
  legit: 'mark.legit',
  attack: 'mark.attack',
  safe: 'mark.safe',
};

/** The word of each kind and of a stopped message, in the reader's language. */
export function messageWord(kind: MessageKind, stopped: boolean, say: Say<MarkKey>): string {
  return say(stopped ? 'mark.stopped' : MARK_KEYS[kind]);
}

/** Steps of one mode in lesson order: shared steps and the steps of that mode (K20). */
export function stepsInMode<T extends { readonly mode: StepMode }>(
  steps: readonly T[],
  defence: boolean,
): T[] {
  const own: StepMode = defence ? 'with-defence' : 'without-defence';
  return steps.filter((s) => s.mode === 'both' || s.mode === own);
}

/**
 * The step `wanted` (from 1) of the mode. A number below 1 or not a number is the first step,
 * a number past the end the last one, a fraction is cut down. Null when the mode has no steps.
 */
export function currentStep<T extends { readonly mode: StepMode }>(
  steps: readonly T[],
  defence: boolean,
  wanted: number,
): { readonly number: number; readonly count: number; readonly step: T } | null {
  const list = stepsInMode(steps, defence);
  const count = list.length;
  if (count === 0) return null;
  const whole = Number.isFinite(wanted) ? Math.floor(wanted) : wanted > 0 ? count : 1;
  const number = Math.min(count, Math.max(1, whole));
  const found = list[number - 1];
  return found === undefined ? null : { number, count, step: found };
}

/**
 * How far along its path the message is after `elapsedMs` of the step: ease in and out (as in
 * the prototype), exactly ½ at half time. With reduced motion it is there at once (S11).
 */
export function travelProgress(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  if (Number.isNaN(elapsedMs) || elapsedMs <= 0) return 0;
  if (elapsedMs >= TRAVEL_MS) return 1;
  const p = elapsedMs / TRAVEL_MS;
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

const count = (text: string) => Array.from(text).length;

/**
 * The text of a compact plaque in lines broken at spaces (M1.2d): the first line has `first`
 * px (the sign stands before it), the others `rest`; a line may be drawn down to 85% of its
 * width. A word too long for its line loses its end to «…»; past three lines the third is cut.
 */
function hang(text: string, first: number, rest: number): { lines: string[]; cut: boolean } {
  const room = (i: number) => (i === 0 ? first : rest);
  const most = (i: number) => Math.max(1, Math.floor(room(i) / (CHAR_WIDTH * MIN_SQUEEZE) + 1e-9));
  const lines: string[] = [];
  let line = '';
  let cut = false;
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    if (count(joined) <= most(lines.length)) {
      line = joined;
      continue;
    }
    if (line !== '') lines.push(line);
    line = word;
    if (count(word) > most(lines.length)) {
      line = `${Array.from(word)
        .slice(0, most(lines.length) - 1)
        .join('')}…`;
      cut = true;
    }
  }
  if (line !== '') lines.push(line);
  if (lines.length <= COMPACT_LINES) return { lines, cut };
  const kept = lines.slice(0, COMPACT_LINES);
  const last = Array.from(kept[COMPACT_LINES - 1] ?? '');
  kept[COMPACT_LINES - 1] = `${last.slice(0, most(COMPACT_LINES - 1) - 1).join('')}…`;
  return { lines: kept, cut: true };
}

/**
 * The plaque for `maxWidth` of room (shadow included): one line as in the prototype when it
 * fits; else compact (M1.2c, M1.2d): the sign before the first line, the text in up to three
 * lines broken at spaces, the next lines under the sign, a line a little too wide drawn
 * narrower (down to 85%), the rest cut with «…».
 */
function plaqueOf(message: string, maxWidth: number): PlaqueLayout {
  const text = Array.from(message.trim()).join('');
  const full = count(text) * CHAR_WIDTH;
  const wide = Math.max(48, full + 2 * PLAQUE_PAD + SIGN_ROOM);
  if (wide + PLAQUE_SHADOW <= maxWidth) {
    return {
      width: wide,
      height: MESSAGE_HEIGHT,
      text,
      lines: [{ text, x: 25, y: 4, fit: null }],
      cut: false,
      signX: 15,
      signY: 0,
      textX: 25,
    };
  }
  const textMax = Math.max(CHAR_WIDTH, maxWidth - PLAQUE_SHADOW - COMPACT_PAD - COMPACT_END);
  const firstMax = Math.max(CHAR_WIDTH, textMax - COMPACT_SIGN);
  const wrapped = hang(text, firstMax, textMax);
  const texts = wrapped.lines.length === 0 ? [''] : wrapped.lines;
  const n: 1 | 2 | 3 = texts.length >= 3 ? 3 : texts.length === 2 ? 2 : 1;
  const drawn = texts.map((t, i) => Math.min(count(t) * CHAR_WIDTH, i === 0 ? firstMax : textMax));
  const head = drawn[0] ?? 0;
  // The sign gets back up to its full room when the first line leaves it.
  const sign = Math.min(SIGN_ROOM, Math.max(COMPACT_SIGN, textMax - head));
  const inner = Math.max(sign + head, ...drawn.slice(1));
  const lines = texts.map((t, i) => {
    const natural = count(t) * CHAR_WIDTH;
    const width = drawn[i] ?? natural;
    return {
      text: t,
      x: i === 0 ? COMPACT_PAD + sign : COMPACT_PAD,
      y: LINE_BASELINES[n][i] ?? 0,
      fit: natural > width ? width : null,
    };
  });
  return {
    width: inner + COMPACT_PAD + COMPACT_END,
    height: HEIGHTS[n],
    text: texts.join(' '),
    lines,
    cut: wrapped.cut,
    signX: COMPACT_PAD + sign / 2,
    signY: (lines[0]?.y ?? 4) - 4,
    textX: COMPACT_PAD + sign,
  };
}

/**
 * The room a message has at participant `p` (M1.2c): its zone frame 2 px in — so a message at
 * rest never covers a neighbour's frame — or its own column frame when it is in no zone.
 */
function roomAt(scene: SceneLayout, p: SceneLayout['participants'][number]) {
  const zone = scene.zones.find((z) => z.members.includes(p.id))?.rect;
  const x1 = zone === undefined ? p.span.x1 : zone.x;
  const x2 = zone === undefined ? p.span.x2 : zone.x + zone.width;
  return { x1: Math.max(EDGE, x1 + 2), x2: Math.min(scene.width - EDGE, x2 - 2) };
}

/**
 * Where a message reaching `left` and `right` from its middle rests at participant `p`: over its
 * column, moved just enough to stay in its room, and always inside the scene.
 */
function restX(
  scene: SceneLayout,
  p: SceneLayout['participants'][number],
  left: number,
  right: number,
): number {
  const room = roomAt(scene, p);
  let x = p.cx;
  if (room.x2 - room.x1 >= left + right) {
    x = Math.min(room.x2 - right, Math.max(room.x1 + left, x));
  }
  return Math.min(scene.width - EDGE - right, Math.max(EDGE + left, x));
}

/** Where the message of `step` stands after `elapsedMs`; null if a participant is missing. */
export function layoutMessage(
  scene: SceneLayout,
  step: StepInput,
  elapsedMs: number,
  reducedMotion: boolean,
  say: Say<MarkKey>,
): MessageLayout | null {
  const from = scene.participants.find((p) => p.id === step.from);
  const to = scene.participants.find((p) => p.id === step.to);
  if (from === undefined || to === undefined) return null;
  const moves = from.id !== to.id;
  const progress = moves ? travelProgress(elapsedMs, reducedMotion) : 1;
  const y = scene.lane.y;

  // One size for the whole step: what fits the room at both ends (M1.2c).
  const roomFrom = roomAt(scene, from);
  const roomTo = roomAt(scene, to);
  const room = Math.min(roomFrom.x2 - roomFrom.x1, roomTo.x2 - roomTo.x1);
  const token = step.icon === null ? null : { icon: step.icon, radius: TOKEN_RADIUS };
  const plaque = token === null ? plaqueOf(step.message, room) : null;

  // A stopped message travels as its kind and gets the shield where it stops (D3 a).
  const stoppedHere = step.stopped && progress === 1;
  let sign: MessageSign;
  if (stoppedHere) sign = 'stopped';
  else if (step.kind === 'attack') sign = 'attack';
  else if (step.kind === 'safe') sign = 'safe';
  else if (!moves) sign = 'here';
  else sign = to.cx > from.cx ? 'right' : 'left';

  // The word: as wide as its letters, drawn narrower to the room (not below 85%). The body
  // reaches 3 px further right (its shadow), so the word leaves that much at each side.
  const word = messageWord(step.kind, stoppedHere, say);
  const natural = Array.from(word).length * (CHAR_WIDTH + WORD_SPACING);
  const wordWidth = Math.max(natural * MIN_SQUEEZE, Math.min(natural, room - 2 * PLAQUE_SHADOW));
  const wordFit = wordWidth < natural ? wordWidth : null;
  // Body: the plaque with its shadow, or the token with its shadow (2 px) and badge.
  const body =
    plaque === null
      ? {
          left: TOKEN_RADIUS,
          right: TOKEN_RADIUS + 3,
          top: TOKEN_RADIUS + 2,
          bottom: TOKEN_RADIUS + 2,
        }
      : {
          left: plaque.width / 2,
          right: plaque.width / 2 + PLAQUE_SHADOW,
          top: plaque.height / 2,
          bottom: plaque.height / 2 + PLAQUE_SHADOW,
        };
  const left = Math.max(body.left, wordWidth / 2);
  const right = Math.max(body.right, wordWidth / 2);
  const startX = restX(scene, from, left, right);
  const x = startX + (restX(scene, to, left, right) - startX) * progress;
  const wordY = y - TOKEN_RADIUS - 5;

  return {
    kind: step.kind,
    stopped: stoppedHere,
    paint: stoppedHere ? 'stopped' : step.kind,
    trailPaint: step.kind,
    sign,
    word,
    wordY,
    wordFit,
    x,
    y,
    progress,
    arrived: progress === 1,
    trail: moves && progress > 0 ? { x1: startX, x2: x, y } : null,
    ring: to.area,
    plaque,
    token,
    body: {
      x: x - body.left,
      y: y - body.top,
      width: body.left + body.right,
      height: body.top + body.bottom,
    },
    wordBox: {
      x: x - wordWidth / 2,
      y: wordY - MESSAGE_FONT_SIZE * 0.8,
      width: wordWidth,
      height: MESSAGE_FONT_SIZE * 1.05,
    },
  };
}
