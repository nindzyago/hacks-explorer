/**
 * The event feed (M1.5, K75): one line per step of the current mode that has started, from the
 * first to the current one, newest last. Derived from the player state and nothing else — not an
 * append-only log — so the same step, mode and arrival always give the same lines, and
 * `player.back` gives back exactly the feed of the step before (S1).
 */
import type { Say } from '../i18n/say';
import type { MessageKind, StepMode } from '../lesson/types';
import {
  currentStep,
  messageWord,
  stepsInMode,
  travelProgress,
  type MarkKey,
} from '../scene-layout/message';

/** The part of a lesson step the feed needs (`SiteStep` fits). */
export interface FeedStep {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly mode: StepMode;
  readonly stopped: boolean;
  readonly message: string;
}

export interface FeedLesson {
  readonly steps: readonly FeedStep[];
  readonly participants: readonly { readonly id: string; readonly name: string }[];
}

/** The mark of a line: the kind of its message, `stopped`, or `moving` while on its way. */
export type FeedMark = MessageKind | 'stopped' | 'moving';

export interface FeedLine {
  /** Number of the step in the current mode, from 1. */
  readonly number: number;
  readonly id: string;
  /** «Кто → Кому: сообщение», or «Кто: сообщение» when it stays with its participant. */
  readonly text: string;
  /** The two parts of `text`: «Кто → Кому» (or «Кто») and the message. */
  readonly who: string;
  readonly message: string;
  readonly kind: MessageKind;
  readonly stopped: boolean;
  readonly mark: FeedMark;
  /** The word that doubles the colour of the mark, in the reader's language (M2.3). */
  readonly word: string;
  readonly current: boolean;
}

/**
 * Has the message of the current step arrived after `elapsedMs` of player time? At once with
 * reduced motion (S11) and for a step whose message does not move — as the scene draws it.
 */
export function stepArrived(
  step: Pick<FeedStep, 'from' | 'to'>,
  elapsedMs: number,
  reducedMotion: boolean,
): boolean {
  if (step.from === step.to) return true;
  return travelProgress(elapsedMs, reducedMotion) === 1;
}

/**
 * Lines of the feed for the player at `position`: steps 1…current of the mode (the step number
 * is cut like the player's: past the end — the last, below 1 or NaN — the first). `arrived` says
 * whether the current step's message is there (`stepArrived`); until then its line is `moving`.
 */
export function feedLines(
  lesson: FeedLesson,
  position: { readonly step: number; readonly defence: boolean },
  arrived: boolean,
  say: Say<MarkKey>,
): FeedLine[] {
  const current = currentStep(lesson.steps, position.defence, position.step);
  if (current === null) return [];
  const names = new Map(lesson.participants.map((p) => [p.id, p.name]));
  const name = (id: string) => names.get(id) ?? id;
  return stepsInMode(lesson.steps, position.defence)
    .slice(0, current.number)
    .map((step, i): FeedLine => {
      const number = i + 1;
      const isCurrent = number === current.number;
      const moving = isCurrent && !arrived;
      const who = step.from === step.to ? name(step.from) : `${name(step.from)} → ${name(step.to)}`;
      return {
        number,
        id: step.id,
        text: `${who}: ${step.message}`,
        who,
        message: step.message,
        kind: step.kind,
        stopped: step.stopped,
        mark: moving ? 'moving' : step.stopped ? 'stopped' : step.kind,
        word: moving ? say('mark.moving') : messageWord(step.kind, step.stopped, say),
        current: isCurrent,
      };
    });
}
