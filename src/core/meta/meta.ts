/**
 * The title and description of a page (M4.3): made from the lesson's own data and the interface
 * strings, the same at build time (the static page each lesson gets, read by link previews and
 * search engines that do not run scripts) and at run time (the page the reader has open).
 * Pure: no DOM, no files. Lesson text is hostile input (L0.2): it is only ever text here.
 */
import { PROJECT } from '../project';
import type { Say } from '../i18n/say';

/** The interface strings these functions need (content/locales/<lang>/ui.md). */
export type MetaKey = 'meta.lesson.description';

/** Link previews cut longer descriptions anyway; a hostile lesson cannot make one huge. */
export const MAX_DESCRIPTION_LENGTH = 250;

/** The parts of a lesson passport a description is made of. */
export interface DescribedPassport {
  readonly class: string | null;
  readonly impact: string | null;
  readonly defence: string | null;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A part of a sentence: one line, without its own final stop (the template has one). */
function part(text: string | null): string | null {
  if (text === null) return null;
  const cut = oneLine(text).replace(/[.!?…\s]+$/u, '');
  return cut === '' ? null : cut;
}

/** `text` cut to at most `max` characters at the last space, with an ellipsis. */
export function clip(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const head = chars.slice(0, max - 1).join('');
  const space = head.lastIndexOf(' ');
  const cut = space > 0 ? head.slice(0, space) : head;
  return `${cut.replace(/[\s,.;:—-]+$/u, '')}…`;
}

/**
 * Lowers the first letter when the first word is a plain capitalised word ("Update", "A",
 * "Обновить", "Офлайн-копии"); keeps acronyms and names ("HTTPS", "CSRF-токен", "Log4j", "iOS").
 */
export function lowerFirstWord(text: string): string {
  const match = /^(\p{Lu})(\p{Ll}*)(?=$|[\s,.;:-])/u.exec(text);
  if (match === null) return text;
  const [whole, first = '', rest = ''] = match;
  return `${first.toLowerCase()}${rest}${text.slice(whole.length)}`;
}

/** The title of a page: its name, then the project; the project alone without a name. */
export function pageTitle(name: string | null): string {
  const own = name === null ? '' : oneLine(name);
  return own === '' ? PROJECT.name : `${own} — ${PROJECT.name}`;
}

/**
 * The description of a lesson page: the class of the attack, what it leads to and how to stop
 * it, in the language's template `meta.lesson.description`. Null when a part is missing: the
 * page then says the site's own description (`app.description`).
 */
export function lessonDescription(passport: DescribedPassport, say: Say<MetaKey>): string | null {
  const kind = part(passport.class);
  const impact = part(passport.impact);
  const defence = part(passport.defence);
  if (kind === null || impact === null || defence === null) return null;
  const text = oneLine(
    say('meta.lesson.description', { class: kind, impact, defence: lowerFirstWord(defence) }),
  );
  return clip(text, MAX_DESCRIPTION_LENGTH);
}
