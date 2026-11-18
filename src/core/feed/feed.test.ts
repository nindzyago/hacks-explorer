// M1.5: the event feed is derived from the player state (K75), never appended to: the same step,
// mode and arrival always give the same lines, so `player.back` gives back exactly the feed of
// the step before (S1).
import { describe, expect, it } from 'vitest';
import type { MessageKind, StepMode } from '../lesson/types';
import { feedLines, stepArrived, type FeedStep } from './feed';

const step = (
  id: string,
  from: string,
  to: string,
  kind: MessageKind,
  mode: StepMode = 'both',
  stopped = false,
): FeedStep => ({ id, from, to, kind, mode, stopped, message: `msg ${id}` });

// B1 in short: two shared steps, three without the defence, three with it (one stopped).
const steps: readonly FeedStep[] = [
  step('form', 'attacker', 'server', 'legit'),
  step('trick', 'attacker', 'server', 'attack'),
  step('glue', 'server', 'db', 'attack', 'without-defence'),
  step('answer', 'db', 'server', 'attack', 'without-defence'),
  step('enter', 'server', 'attacker', 'attack', 'without-defence'),
  step('param', 'server', 'db', 'attack', 'with-defence', true),
  step('empty', 'db', 'server', 'safe', 'with-defence'),
  step('refuse', 'server', 'attacker', 'safe', 'with-defence'),
];
const participants = [
  { id: 'attacker', name: 'Атакующий' },
  { id: 'server', name: 'Веб-сервер' },
  { id: 'db', name: 'База данных' },
];
const lesson = { steps, participants };

describe('feedLines', () => {
  it('has one line per step up to the current one, the current one on its way (S1)', () => {
    const lines = feedLines(lesson, { step: 4, defence: false }, false);
    expect(lines.map((l) => l.number)).toEqual([1, 2, 3, 4]);
    expect(lines.map((l) => l.id)).toEqual(['form', 'trick', 'glue', 'answer']);
    expect(lines.map((l) => l.mark)).toEqual(['legit', 'attack', 'attack', 'moving']);
    expect(lines.map((l) => l.current)).toEqual([false, false, false, true]);
    expect(lines[3]).toMatchObject({ word: 'в пути', kind: 'attack' });
  });

  it('marks the current line by its kind once the message has arrived', () => {
    const lines = feedLines(lesson, { step: 4, defence: false }, true);
    expect(lines.map((l) => l.mark)).toEqual(['legit', 'attack', 'attack', 'attack']);
    expect(lines.map((l) => l.word)).toEqual(['обычное', 'вредное', 'вредное', 'вредное']);
  });

  it('marks the stopped step «остановлено» in the defence mode (S2)', () => {
    const lines = feedLines(lesson, { step: 5, defence: true }, true);
    expect(lines.map((l) => l.id)).toEqual(['form', 'trick', 'param', 'empty', 'refuse']);
    expect(lines.map((l) => l.mark)).toEqual(['legit', 'attack', 'stopped', 'safe', 'safe']);
    expect(lines[2]).toMatchObject({ word: 'остановлено', kind: 'attack', stopped: true });
    // On its way the stopped message is not yet stopped.
    expect(feedLines(lesson, { step: 3, defence: true }, false)[2]?.mark).toBe('moving');
  });

  it('writes who sends what to whom, by the names of the participants', () => {
    const [first] = feedLines(lesson, { step: 1, defence: false }, true);
    expect(first?.text).toBe('Атакующий → Веб-сервер: msg form');
  });

  it('writes one name for a step that stays with its participant, an id for an unknown one', () => {
    const own = {
      steps: [step('think', 'server', 'server', 'legit'), step('x', 'ghost', 'db', 'legit')],
      participants,
    };
    const lines = feedLines(own, { step: 2, defence: false }, true);
    expect(lines.map((l) => l.text)).toEqual([
      'Веб-сервер: msg think',
      'ghost → База данных: msg x',
    ]);
  });

  it('is the same for the same state: back gives the lines of the step before', () => {
    const three = feedLines(lesson, { step: 3, defence: false }, false);
    feedLines(lesson, { step: 4, defence: false }, false);
    expect(feedLines(lesson, { step: 3, defence: false }, false)).toEqual(three);
  });

  it('cuts a step number past either end like the player, and is empty without steps', () => {
    expect(feedLines(lesson, { step: 99, defence: false }, true)).toHaveLength(5);
    expect(feedLines(lesson, { step: 0, defence: false }, false)).toHaveLength(1);
    expect(feedLines(lesson, { step: Number.NaN, defence: true }, false)).toHaveLength(1);
    expect(feedLines(lesson, { step: 2.7, defence: false }, false)).toHaveLength(2);
    expect(feedLines({ steps: [], participants }, { step: 3, defence: false }, true)).toEqual([]);
    const onlyWithout = { steps: [steps[2] ?? step('a', 'a', 'b', 'legit')], participants };
    expect(feedLines(onlyWithout, { step: 1, defence: true }, true)).toEqual([]);
  });
});

describe('stepArrived', () => {
  const moving = step('glue', 'server', 'db', 'attack');
  it('is false until the message has travelled, true from then on', () => {
    expect(stepArrived(moving, 0, false)).toBe(false);
    expect(stepArrived(moving, 899, false)).toBe(false);
    expect(stepArrived(moving, 900, false)).toBe(true);
    expect(stepArrived(moving, Number.NaN, false)).toBe(false);
  });

  it('is true at once with reduced motion (S11) and for a step that does not move', () => {
    expect(stepArrived(moving, 0, true)).toBe(true);
    expect(stepArrived(step('think', 'server', 'server', 'legit'), 0, false)).toBe(true);
  });
});
