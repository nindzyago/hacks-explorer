/**
 * The catalog of all topics of the site: `content/locales/<lang>/catalog.md` (M2.1 E3, K112).
 * A Markdown file read line by line, so every line means exactly one thing:
 *
 *   # <any title>
 *   `catalog` <lang> · `format` 1
 *   ## `B` <section name>
 *   ## `B` <section name> · <short name, optional: the chip of the lessons column, UI2>
 *   - `B1` <topic title>
 *   - `B8` <topic title> — <what the scene shows, optional>
 *
 * Other lines are notes and are ignored; a line that starts like a list item or a heading must be
 * one of the above. Text is plain. The file is hostile input (a pull request): every error is data
 * with the line, never an exception. Build time only; the site gets `SiteTopics` (site.ts).
 */
import { createReporter, capReported, START, quote } from '../lesson/report';
import type { LessonError } from '../lesson/types';
import { hasHiddenCharacter, withoutBom } from '../i18n/ui-file';

export const CATALOG_FORMAT = 1;
/** A catalog larger than this is not read at all. */
export const MAX_CATALOG_FILE_BYTES = 64 * 1024;
export const MAX_TOPICS = 300;
export const MAX_TOPIC_TITLE_LENGTH = 80;
export const MAX_SECTION_TITLE_LENGTH = 60;
export const MAX_NOTE_LENGTH = 200;
/** The short name of a section, on a chip of the lessons column (UI2). */
export const MAX_SHORT_LENGTH = 20;
/** Sections A to L (plan/content-catalog.md; L added by the owner, K9). */
export const SECTION_ID = /^[A-L]$/;
/** A topic: its section letter and a number, `B1`, `K12`. */
export const TOPIC_ID = /^[A-L][1-9][0-9]?$/;

const HEADER = /^\x60catalog\x60 ([a-z]{2,3}) · \x60format\x60 ([0-9]+)$/;
const SECTION = /^## \x60([^\x60]*)\x60(?:[ \t]+(.*))?$/;
const TOPIC = /^- \x60([^\x60]*)\x60(?:[ \t]+(.*))?$/;
const PATH = /^content\/locales\/([a-z]{2,3})\/catalog\.md$/;
/** Between the title and the optional note. */
const NOTE_SEPARATOR = /\s—(?:\s|$)/;
/** Between the section name and its optional short name. */
const SHORT_SEPARATOR = /\s·(?:\s|$)/;
const MARKUP = /[<>{}\x60]/;

export function catalogPath(language: string): string {
  return `content/locales/${language}/catalog.md`;
}

export interface CatalogTopic {
  readonly id: string;
  readonly title: string;
  readonly note: string | null;
  readonly line: number;
}

export interface CatalogSection {
  readonly id: string;
  readonly title: string;
  /** The short name after « · », null when the heading has none. */
  readonly short: string | null;
  readonly line: number;
  readonly topics: readonly CatalogTopic[];
}

export interface CatalogFile {
  readonly path: string;
  readonly language: string;
  readonly title: string;
  /** In file order. */
  readonly sections: readonly CatalogSection[];
}

export type CatalogFileResult =
  | { readonly ok: true; readonly file: CatalogFile }
  | { readonly ok: false; readonly errors: readonly LessonError[] };

function plainText(value: string): boolean {
  return !MARKUP.test(value) && !hasHiddenCharacter(value);
}

export function parseCatalogFile(path: string, text: unknown): CatalogFileResult {
  const reporter = createReporter(path);
  const failed = (): CatalogFileResult => ({ ok: false, errors: capReported(reporter) });
  const pathMatch = PATH.exec(path);
  if (pathMatch === null) {
    reporter.add(START, '', 'bad-path', 'a catalog is content/locales/<lang>/catalog.md');
    return failed();
  }
  const language = pathMatch[1] ?? '';
  if (typeof text !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return failed();
  }
  // In UTF-8 bytes; a string longer in characters is larger in bytes too, so it is not encoded.
  if (
    text.length > MAX_CATALOG_FILE_BYTES ||
    new TextEncoder().encode(text).length > MAX_CATALOG_FILE_BYTES
  ) {
    reporter.add(START, '', 'too-large', `larger than ${String(MAX_CATALOG_FILE_BYTES)} bytes`);
    return failed();
  }

  let title: string | null = null;
  let header = false;
  const sections: {
    id: string;
    title: string;
    short: string | null;
    line: number;
    topics: CatalogTopic[];
  }[] = [];
  const topicIds = new Set<string>();
  let topicCount = 0;

  for (const [i, raw] of withoutBom(text).split(/\r?\n/).entries()) {
    const at = { line: i + 1, column: 1 };
    const content = raw.trim();
    if (content === '') continue;
    if (title === null) {
      if (!content.startsWith('# ') || content.slice(2).trim() === '') {
        reporter.add(at, '', 'missing-title', 'the file starts with a title line: # <title>');
        return failed();
      }
      title = content.slice(2).trim();
      continue;
    }
    if (!header) {
      const m = HEADER.exec(content);
      if (m === null) {
        reporter.add(
          at,
          'header',
          'bad-header',
          `the line after the title is: \`catalog\` ${language} · \`format\` ${String(CATALOG_FORMAT)}`,
        );
        return failed();
      }
      if (m[1] !== language) {
        reporter.add(
          at,
          'header',
          'bad-header',
          `the file is in folder ${language}: write \`catalog\` ${language}`,
        );
      }
      if (m[2] !== String(CATALOG_FORMAT)) {
        reporter.add(
          at,
          'header',
          'bad-header',
          `format ${String(CATALOG_FORMAT)} is the only one`,
        );
      }
      header = true;
      continue;
    }
    if (content.startsWith('#')) {
      const m = SECTION.exec(content);
      const id = m?.[1] ?? '';
      const heading = (m?.[2] ?? '').trim();
      const split = heading.search(SHORT_SEPARATOR);
      const name = (split < 0 ? heading : heading.slice(0, split)).trim();
      const short = split < 0 ? null : heading.slice(split + 2).trim();
      if (m === null || !SECTION_ID.test(id) || name === '') {
        reporter.add(
          at,
          '',
          'bad-line',
          'a section looks like ## `B` Web: injections (one letter A to L)',
        );
        continue;
      }
      if (name.length > MAX_SECTION_TITLE_LENGTH || !plainText(name)) {
        reporter.add(
          at,
          id,
          'not-allowed',
          `the section name is plain text of at most ${String(MAX_SECTION_TITLE_LENGTH)} characters`,
        );
        continue;
      }
      if (
        short !== null &&
        (short === '' || short.length > MAX_SHORT_LENGTH || !plainText(short))
      ) {
        reporter.add(
          at,
          id,
          'not-allowed',
          `the short name after « · » is plain text of 1 to ${String(MAX_SHORT_LENGTH)} characters`,
        );
        continue;
      }
      if (sections.some((s) => s.id === id)) {
        reporter.add(at, id, 'duplicate', `section ${id} is already in this file`);
        continue;
      }
      const previous = sections[sections.length - 1];
      if (previous !== undefined && previous.id > id) {
        reporter.add(
          at,
          id,
          'section-order',
          `sections go A to L: ${id} comes before ${previous.id}`,
        );
      }
      sections.push({ id, title: name, short, line: at.line, topics: [] });
      continue;
    }
    if (!content.startsWith('-') && !content.startsWith('*') && !content.startsWith('+')) continue;
    const m = TOPIC.exec(content);
    const id = m?.[1] ?? '';
    const rest = (m?.[2] ?? '').trim();
    if (m === null || !TOPIC_ID.test(id) || rest === '') {
      reporter.add(
        at,
        '',
        'bad-line',
        'a topic looks like - `B1` SQL injection (section letter and number)',
      );
      continue;
    }
    const cut = rest.search(NOTE_SEPARATOR);
    const topicTitle = (cut < 0 ? rest : rest.slice(0, cut)).trim();
    const note = cut < 0 ? null : rest.slice(cut + 2).trim();
    if (topicTitle === '' || topicTitle.length > MAX_TOPIC_TITLE_LENGTH || !plainText(topicTitle)) {
      reporter.add(
        at,
        id,
        'not-allowed',
        `the title is plain text of 1 to ${String(MAX_TOPIC_TITLE_LENGTH)} characters: «${quote(topicTitle)}»`,
      );
      continue;
    }
    if (note !== null && (note === '' || note.length > MAX_NOTE_LENGTH || !plainText(note))) {
      reporter.add(
        at,
        id,
        'not-allowed',
        `the note after « — » is plain text of 1 to ${String(MAX_NOTE_LENGTH)} characters`,
      );
      continue;
    }
    const section = sections[sections.length - 1];
    if (section === undefined) {
      reporter.add(at, id, 'stray-content', 'a topic stands under a section heading ## `X` <name>');
      continue;
    }
    if (id[0] !== section.id) {
      reporter.add(
        at,
        id,
        'unknown-section',
        `${id} belongs to section ${id[0] ?? ''}, not ${section.id}`,
      );
      continue;
    }
    if (topicIds.has(id)) {
      reporter.add(at, id, 'duplicate', `${id} is already in this file`);
      continue;
    }
    topicCount += 1;
    if (topicCount > MAX_TOPICS) {
      reporter.add(at, id, 'too-large', `at most ${String(MAX_TOPICS)} topics`);
      break;
    }
    topicIds.add(id);
    section.topics.push({ id, title: topicTitle, note, line: at.line });
  }
  if (title === null || !header) {
    reporter.add(
      START,
      'header',
      'bad-header',
      'a title and the line `catalog` <lang> · `format` 1',
    );
  }
  for (const section of sections) {
    if (section.topics.length === 0) {
      reporter.add(
        { line: section.line, column: 1 },
        section.id,
        'empty-section',
        `section ${section.id} has no topics`,
      );
    }
  }
  if (reporter.total() > 0) return failed();
  return { ok: true, file: { path, language, title: title ?? '', sections } };
}
