/**
 * The text a screen reader gets for a still scene (design M1.2 E9): who stands where and which
 * zone holds whom, and the current step. The words come from the reader's language (M2.3): the
 * caller passes the translator, these functions only put the parts together.
 */
import type { Say } from '../i18n/say';
import type { SceneInput } from './layout';
import { messageWord, type MarkKey, type StepInput } from './message';

/** The interface strings (content/locales/<lang>/ui.md) the descriptions use. */
export type DescribeKey =
  | MarkKey
  | 'lesson.noSteps'
  | 'scene.title'
  | 'scene.empty'
  | 'scene.participants'
  | 'scene.zones'
  | 'scene.dangerZone'
  | 'scene.step'
  | 'scene.stepStopped'
  | 'scene.stepStoppedAt'
  | 'scene.stays';

/** The current step in words (E9): «Шаг 3 из 5. Заголовок: кто → кому, вредное сообщение «…».» */
export function describeStep(
  participants: SceneInput['participants'],
  current: { readonly number: number; readonly count: number; readonly step: StepInput } | null,
  say: Say<DescribeKey>,
): string {
  if (current === null) return say('lesson.noSteps');
  const { number, count, step } = current;
  const name = (id: string) => participants.find((p) => p.id === id)?.name ?? id;
  const route =
    step.from === step.to
      ? say('scene.stays', { name: name(step.to) })
      : `${name(step.from)} → ${name(step.to)}`;
  const params = {
    number,
    count,
    title: step.title,
    route,
    kind: messageWord(step.kind, false, say),
    message: step.message,
  };
  if (!step.stopped) return say('scene.step', params);
  // «… вредное сообщение «…» остановлено у участника «База данных».»: the message, not the
  // participant, is what was stopped. A step that stays with one participant has already named it.
  if (step.from === step.to) return say('scene.stepStopped', params);
  return say('scene.stepStoppedAt', { ...params, name: name(step.to) });
}

export function sceneTitle(lessonTitle: string, say: Say<DescribeKey>): string {
  return say('scene.title', { title: lessonTitle });
}

export function describeScene(input: SceneInput, say: Say<DescribeKey>): string {
  const names = new Map(input.participants.map((p) => [p.id, p.name]));
  if (input.participants.length === 0) return say('scene.empty');
  const who = input.participants
    .map((p) => (p.note.trim() === '' ? p.name : `${p.name} (${p.note})`))
    .join(', ');
  const zones = input.zones.flatMap((z) => {
    const members = z.members.flatMap((m) => {
      const name = names.get(m);
      return name === undefined ? [] : [name];
    });
    if (members.length === 0) return [];
    const label = z.danger ? say('scene.dangerZone', { label: z.label }) : z.label;
    return [`${label}: ${members.join(', ')}`];
  });
  const parts = [say('scene.participants', { list: who })];
  if (zones.length > 0) parts.push(say('scene.zones', { list: zones.join('; ') }));
  return parts.join(' ');
}
