/**
 * The message of the current step (design M1.2 E2, E8, D3 a / K44): which step is current in a
 * mode, and where its message stands at a moment of the player clock. Pure: the same step,
 * scene and elapsed time always give the same answer, so a screenshot repeats byte for byte.
 */
import type { MessageKind, StepMode } from '../lesson/types';
import type { Rect, SceneLayout } from './layout';

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
  readonly plaque: {
    readonly width: number;
    readonly height: number;
    readonly text: string;
    /** The text did not fit and ends with «…». */
    readonly cut: boolean;
  } | null;
  readonly token: { readonly icon: string; readonly radius: number } | null;
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

function plaqueOf(message: string, maxWidth: number): NonNullable<MessageLayout['plaque']> {
  const chars = Array.from(message.trim());
  const room = Math.max(1, Math.floor((maxWidth - 2 * PLAQUE_PAD - SIGN_ROOM) / CHAR_WIDTH));
  const cut = chars.length > room;
  const text = cut ? `${chars.slice(0, Math.max(0, room - 1)).join('')}…` : chars.join('');
  const width = Math.max(48, Array.from(text).length * CHAR_WIDTH + 2 * PLAQUE_PAD + SIGN_ROOM);
  return { width, height: MESSAGE_HEIGHT, text, cut };
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
  const pathX = from.cx + (to.cx - from.cx) * progress;
  const y = scene.lane.y;

  const token = step.icon === null ? null : { icon: step.icon, radius: TOKEN_RADIUS };
  const plaque = token === null ? plaqueOf(step.message, scene.width - 2 * EDGE) : null;
  const half = plaque === null ? TOKEN_RADIUS + 2 : plaque.width / 2;
  // A long plaque at the first or last participant would stick out of the scene.
  const x = Math.min(scene.width - EDGE - half, Math.max(EDGE + half, pathX));

  // A stopped message travels as its kind and gets the shield where it stops (D3 a).
  const stoppedHere = step.stopped && progress === 1;
  let sign: MessageSign;
  if (stoppedHere) sign = 'stopped';
  else if (step.kind === 'attack') sign = 'attack';
  else if (step.kind === 'safe') sign = 'safe';
  else if (!moves) sign = 'here';
  else sign = to.cx > from.cx ? 'right' : 'left';

  return {
    kind: step.kind,
    stopped: stoppedHere,
    sign,
    word: messageWord(step.kind, stoppedHere),
    wordY: y - TOKEN_RADIUS - 5,
    x,
    y,
    progress,
    arrived: progress === 1,
    trail: moves && progress > 0 ? { x1: from.cx, x2: x, y } : null,
    ring: to.area,
    plaque,
    token,
  };
}
