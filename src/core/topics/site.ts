/**
 * The catalog of topics as the site gets it (M2.1 E3, K112): `data/topics/<lang>.json`, loaded
 * the first time the reader opens the lessons panel. Every section and topic in the language of
 * the page; `ready` is true when the lesson exists in that language (the build knows it).
 *
 * This file imports nothing that pulls the Markdown parser, so the site may import it.
 */
import type { ReadResult } from '../lesson/site-read';
import { fail, field, list, matching, object, read, str } from '../lesson/site-read';
import type { CatalogFile } from './file';

export const TOPICS_FORMAT = 1;
/** Budget of one topics file, as served (K112). */
export const MAX_TOPICS_FILE_BYTES = 30 * 1024;
/** More is a hostile file: the checker allows 300 topics. */
const MAX_SITE_TOPICS = 300;

export function topicsFile(language: string): string {
  return `data/topics/${language}.json`;
}

export interface SiteTopic {
  readonly id: string;
  readonly title: string;
  /** What the scene shows, a line under the title; null when the catalog has none. */
  readonly note: string | null;
  /** The lesson exists in this language and opens. */
  readonly ready: boolean;
}

export interface SiteTopicSection {
  readonly id: string;
  readonly title: string;
  /** The name on the section's chip in the lessons column (UI2): its short name, else the title. */
  readonly short: string;
  readonly topics: readonly SiteTopic[];
}

export interface SiteTopics {
  readonly format: typeof TOPICS_FORMAT;
  readonly language: string;
  readonly sections: readonly SiteTopicSection[];
}

/** The site data of a checked catalog; `ready` holds the ids of lessons in its language. */
export function toSiteTopics(file: CatalogFile, ready: ReadonlySet<string>): SiteTopics {
  return {
    format: TOPICS_FORMAT,
    language: file.language,
    sections: file.sections.map((s) => ({
      id: s.id,
      title: s.title,
      short: s.short ?? s.title,
      topics: s.topics.map((t) => ({
        id: t.id,
        title: t.title,
        note: t.note,
        ready: ready.has(t.id),
      })),
    })),
  };
}

const LANGUAGE = /^[a-z]{2,3}$/;
const SECTION_ID = /^[A-L]$/;
const TOPIC_ID = /^[A-L][1-9][0-9]?$/;

function topic(input: unknown, path: string): SiteTopic {
  const o = object(input, path);
  const note = field(o, 'note');
  if (note !== null && typeof note !== 'string') fail(`${path}.note`, 'text or null');
  const ready = field(o, 'ready');
  if (typeof ready !== 'boolean') fail(`${path}.ready`, 'true or false');
  return { id: matching(o, 'id', path, TOPIC_ID), title: str(o, 'title', path), note, ready };
}

function section(input: unknown, path: string): SiteTopicSection {
  const o = object(input, path);
  const id = matching(o, 'id', path, SECTION_ID);
  const topics = list(field(o, 'topics'), `${path}.topics`, topic);
  topics.forEach((t, i) => {
    if (!t.id.startsWith(id)) fail(`${path}.topics[${String(i)}].id`, `a topic of section ${id}`);
  });
  return { id, title: str(o, 'title', path), short: str(o, 'short', path), topics };
}

function topics(input: unknown, language: string): SiteTopics {
  const o = object(input, '');
  if (field(o, 'format') !== TOPICS_FORMAT) fail('format', `format ${String(TOPICS_FORMAT)}`);
  if (field(o, 'language') !== language || !LANGUAGE.test(language))
    fail('language', `the language ${language}`);
  const sections = list(field(o, 'sections'), 'sections', section);
  if (new Set(sections.map((s) => s.id)).size !== sections.length)
    fail('sections', 'each section once');
  const ids = sections.flatMap((s) => s.topics.map((t) => t.id));
  if (ids.length > MAX_SITE_TOPICS) fail('sections', `at most ${String(MAX_SITE_TOPICS)} topics`);
  if (new Set(ids).size !== ids.length) fail('sections', 'each topic once');
  return { format: TOPICS_FORMAT, language, sections };
}

/** Reads a topics file (hostile input, L0.2); a file of another language is bad data. */
export function readSiteTopics(input: unknown, language: string): ReadResult<SiteTopics> {
  return read(input, (value) => topics(value, language));
}
