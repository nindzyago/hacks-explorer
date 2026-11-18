/**
 * The text a screen reader gets for a still scene (design M1.2 E9): who stands where and which
 * zone holds whom. M1.2b adds the current step. Russian, like the page; the strings move to
 * i18n with M2.3.
 */
import type { SceneInput } from './layout';

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
