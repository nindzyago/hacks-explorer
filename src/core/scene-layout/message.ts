/**
 * The message of the current step (design M1.2 E2, E8, D3 a / K44): which step is current in a
 * mode, and where its message stands at a moment of the player clock. Pure: the same step,
 * scene and elapsed time always give the same answer, so a screenshot repeats byte for byte.
 */
import type { MessageKind, StepMode } from '../lesson/types';
import { MIN_SQUEEZE, wrap, type Rect, type SceneLayout } from './layout';

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
 * A compact plaque (M1.2c), for a column too narrow for the one-line plaque: 4 px, the sign in
 * 11 px, the text in up to two lines, 4 px.
 */
const COMPACT_PAD = 4;
const COMPACT_SIGN = 11;
const COMPACT_END = 4;
/** Height of a two-line plaque and the baselines of its lines, from its middle. */
export const MESSAGE_HEIGHT_2 = 30;
const LINE_BASELINES: Readonly<Record<1 | 2, readonly number[]>> = { 1: [4], 2: [-3, 10] };
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

export interface MessageLayout {
  readonly kind: MessageKind;
  readonly stopped: boolean;
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
  /** Lines with their baselines from the middle of the plaque and an optional `textLength`. */
  readonly lines: readonly {
    readonly text: string;
    readonly y: number;
    readonly fit: number | null;
  }[];
  /** The text did not fit and ends with «…». */
  readonly cut: boolean;
  /** Where the sign's middle and the text start, from the plaque's left edge. */
  readonly signX: number;
  readonly textX: number;
}

const WORDS: Readonly<Record<MessageKind, string>> = {
  legit: 'обычное',
  attack: 'вредное',
  safe: 'безопасное',
};

/** The words of each kind and of a stopped message, for descriptions. */
export function messageWord(kind: MessageKind, stopped: boolean): string {
  return stopped ? 'остановлено' : WORDS[kind];
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

/**
 * The plaque for `maxWidth` of room (shadow included): one line as in the prototype when it
 * fits; else compact (M1.2c), the text in up to two lines broken at spaces, a word a little
 * too wide drawn narrower (down to 85%), the rest cut with «…».
 */
function plaqueOf(message: string, maxWidth: number): PlaqueLayout {
  const chars = Array.from(message.trim());
  const full = chars.length * CHAR_WIDTH;
  const wide = Math.max(48, full + 2 * PLAQUE_PAD + SIGN_ROOM);
  if (wide + PLAQUE_SHADOW <= maxWidth) {
    const text = chars.join('');
    return {
      width: wide,
      height: MESSAGE_HEIGHT,
      text,
      lines: [{ text, y: 4, fit: null }],
      cut: false,
      signX: 15,
      textX: 25,
    };
  }
  const frame = COMPACT_PAD + COMPACT_SIGN + COMPACT_END;
  const textMax = Math.max(CHAR_WIDTH, maxWidth - PLAQUE_SHADOW - frame);
  const wrapped = wrap(chars.join(''), textMax, MESSAGE_FONT_SIZE, 0, 2, true);
  const texts = wrapped.lines.length === 0 ? [''] : wrapped.lines;
  const baselines = LINE_BASELINES[texts.length === 1 ? 1 : 2];
  const lines = texts.map((text, i) => {
    const natural = Array.from(text).length * CHAR_WIDTH;
    return { text, y: baselines[i] ?? 0, fit: natural > textMax ? textMax : null };
  });
  const drawn = Math.max(...lines.map((l) => l.fit ?? Array.from(l.text).length * CHAR_WIDTH));
  // The sign gets back up to its full room when the lines leave it.
  const free = maxWidth - PLAQUE_SHADOW - COMPACT_PAD - COMPACT_END - drawn;
  const sign = Math.min(SIGN_ROOM, Math.max(COMPACT_SIGN, free));
  return {
    width: drawn + COMPACT_PAD + sign + COMPACT_END,
    height: lines.length === 1 ? MESSAGE_HEIGHT : MESSAGE_HEIGHT_2,
    text: texts.join(' '),
    lines,
    cut: wrapped.cut,
    signX: COMPACT_PAD + sign / 2,
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
  const word = messageWord(step.kind, stoppedHere);
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
