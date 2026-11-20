/**
 * Search in the lessons panel (M2.1 E2, scenario S7) and in the glossary tab: pure, so it is
 * tested without a browser.
 *
 * A query matches a topic when every word of it is found in the topic's title, its section's
 * name or its id (`b1`), ignoring case, ё = е, and punctuation (`sql-инъекция` = `sql инъекция`).
 * A section filter keeps one section. The result keeps the catalog order: sections A to L, topics
 * by number; sections without a match are left out.
 */
import type { SiteTopic, SiteTopicSection } from './site';

/** Longer queries are cut: a search field is hostile input too. */
export const MAX_QUERY_LENGTH = 100;

/** Lower case, ё as е, every run of non-letters and non-digits as one space, trimmed. */
export function normalize(text: string): string {
  return (
    text
      .slice(0, MAX_QUERY_LENGTH * 4)
      .toLowerCase()
      // ё as е (written as escapes: no letters of a language in site code, M2.3).
      .replace(/\u0451/g, '\u0435')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  );
}

/** The words of a query, each at least one character; empty for an empty query. */
export function queryWords(query: string): readonly string[] {
  const words = normalize(query.slice(0, MAX_QUERY_LENGTH));
  return words === '' ? [] : words.split(' ');
}

/** Every word is somewhere in one of the texts. */
export function matchesAll(words: readonly string[], texts: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = texts.map(normalize).join(' ');
  return words.every((word) => haystack.includes(word));
}

export interface TopicFilter {
  readonly query: string;
  /** A section id, or null for all sections. */
  readonly section: string | null;
}

export interface FoundSection {
  readonly section: SiteTopicSection;
  /** The topics of this section that match, in catalog order. */
  readonly topics: readonly SiteTopic[];
}

export function filterTopics(
  sections: readonly SiteTopicSection[],
  filter: TopicFilter,
): readonly FoundSection[] {
  const words = queryWords(filter.query);
  const found: FoundSection[] = [];
  for (const section of sections) {
    if (filter.section !== null && section.id !== filter.section) continue;
    const topics = section.topics.filter((t) => matchesAll(words, [t.title, section.title, t.id]));
    if (topics.length > 0) found.push({ section, topics });
  }
  return found;
}

/** «готово N из M» of one section. */
export function readyCount(section: SiteTopicSection): { ready: number; count: number } {
  return { ready: section.topics.filter((t) => t.ready).length, count: section.topics.length };
}

export interface SideGroup {
  readonly section: SiteTopicSection;
  /** Ready lessons of the section that match, in catalog order. */
  readonly ready: readonly SiteTopic[];
  /** Topics still being written that match, after the ready ones, in catalog order. */
  readonly soon: readonly SiteTopic[];
  /** «готово N из M» of the whole section, whatever the search. */
  readonly readyCount: number;
  readonly count: number;
}

/**
 * The lessons column (UI2): the topics grouped by section, A to L. Within a section the ready
 * lessons come first and the topics still being written after them, each in catalog order; a
 * section chip keeps one section, a search keeps the matching topics, and a section with nothing
 * left is left out.
 */
export function sideGroups(
  sections: readonly SiteTopicSection[],
  filter: TopicFilter,
): readonly SideGroup[] {
  return filterTopics(sections, filter).map(({ section, topics }) => {
    const counts = readyCount(section);
    return {
      section,
      ready: topics.filter((t) => t.ready),
      soon: topics.filter((t) => !t.ready),
      readyCount: counts.ready,
      count: counts.count,
    };
  });
}
