/**
 * The text a screen reader gets for a still scene (design M1.2 E9): who stands where and which
 * zone holds whom. M1.2b adds the current step. Russian, like the page; the strings move to
 * i18n with M2.3.
 */
import type { SceneInput } from './layout';
import { messageWord, type StepInput } from './message';

/** The current step in words (E9): «Шаг 3 из 5. Заголовок: кто → кому, вредное сообщение «…».» */
export function describeStep(
  participants: SceneInput['participants'],
  current: { readonly number: number; readonly count: number; readonly step: StepInput } | null,
): string {
  if (current === null) return 'В этом режиме у урока нет шагов.';
  const { number, count, step } = current;
  const name = (id: string) => participants.find((p) => p.id === id)?.name ?? id;
  const route =
    step.from === step.to
      ? `у участника «${name(step.to)}»`
      : `${name(step.from)} → ${name(step.to)}`;
  const kind = messageWord(step.kind, false);
  // «… вредное сообщение «…» остановлено у участника «База данных».»: the message, not the
  // participant, is what was stopped.
  const stopped = step.stopped ? ` остановлено у участника «${name(step.to)}»` : '';
  return (
    `Шаг ${String(number)} из ${String(count)}. ${step.title}: ${route}, ` +
    `${kind} сообщение «${step.message}»${stopped}.`
  );
}

export function sceneTitle(lessonTitle: string): string {
  return `Схема урока «${lessonTitle}»`;
}

export function describeScene(input: SceneInput): string {
  const names = new Map(input.participants.map((p) => [p.id, p.name]));
  if (input.participants.length === 0) return 'На схеме нет участников.';
  const who = input.participants
    .map((p) => (p.note.trim() === '' ? p.name : `${p.name} (${p.note})`))
    .join(', ');
  const zones = input.zones.flatMap((z) => {
    const members = z.members.flatMap((m) => {
      const name = names.get(m);
      return name === undefined ? [] : [name];
    });
    if (members.length === 0) return [];
    return [`${z.label}${z.danger ? ' (опасная)' : ''}: ${members.join(', ')}`];
  });
  const parts = [`Участники слева направо: ${who}.`];
  if (zones.length > 0) parts.push(`Зоны доверия: ${zones.join('; ')}.`);
  return parts.join(' ');
}
