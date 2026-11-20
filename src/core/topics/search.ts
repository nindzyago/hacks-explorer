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

export interface SideFilter extends TopicFilter {
  /** Show the topics still being written too («Все»), not only the ready lessons («Готовые»). */
  readonly all: boolean;
}

export interface SideList {
  /** Ready lessons that match, in catalog order. */
  readonly ready: readonly SiteTopic[];
  /**
   * Topics still being written that match, after the ready ones (M6, design §2): with «Все», or
   * whenever the reader searches, so a search finds a topic that is not ready yet.
   */
  readonly soon: readonly SiteTopic[];
  /** The counts on the chips: ready lessons and all topics of the chosen section(s). */
  readonly readyCount: number;
  readonly allCount: number;
}

/** The lessons list of the left panel (M6): ready lessons first, the rest at the end. */
export function sideList(sections: readonly SiteTopicSection[], filter: SideFilter): SideList {
  const inSection = sections.filter((s) => filter.section === null || s.id === filter.section);
  const searching = queryWords(filter.query).length > 0;
  const found = filterTopics(inSection, { query: filter.query, section: null }).flatMap(
    (f) => f.topics,
  );
  const topics = inSection.flatMap((s) => s.topics);
  return {
    ready: found.filter((t) => t.ready),
    soon: filter.all || searching ? found.filter((t) => !t.ready) : [],
    readyCount: topics.filter((t) => t.ready).length,
    allCount: topics.length,
  };
}
