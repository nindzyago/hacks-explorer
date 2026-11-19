/**
 * The glossary as the site gets it (M2.4, K98): `data/glossary/<lang>.json`, loaded lazily the
 * first time a reader opens a term. Definitions are text trees with terms already linked by the
 * build; no forms are shipped, the site never searches text (K31).
 *
 * This file and the reader below import nothing that pulls the Markdown parser.
 */
import type { SiteBlock } from '../lesson/site';
import type { Fields, ReadResult } from '../lesson/site-read';
import {
  TERM_ID,
  blocks,
  fail,
  field,
  list,
  listField,
  matching,
  object,
  read,
  str,
} from '../lesson/site-read';

export const GLOSSARY_FORMAT = 1;
/** Budget of one glossary file, as served (K98). */
export const MAX_GLOSSARY_FILE_BYTES = 30 * 1024;

export function glossaryFile(language: string): string {
  return `data/glossary/${language}.json`;
}

export interface SiteGlossaryCategory {
  readonly id: string;
  readonly label: string;
}

export interface SiteGlossaryLesson {
  readonly id: string;
  /** The lesson title in the glossary's language. */
  readonly title: string;
}

export interface SiteGlossaryTerm {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly definition: readonly SiteBlock[];
  readonly see: readonly string[];
  readonly lessons: readonly SiteGlossaryLesson[];
}

export interface SiteGlossary {
  readonly format: typeof GLOSSARY_FORMAT;
  readonly language: string;
  readonly title: string;
  readonly categories: readonly SiteGlossaryCategory[];
  readonly terms: readonly SiteGlossaryTerm[];
}

const LANGUAGE = /^[a-z]{2,3}$/;
const LESSON_ID = /^[A-Z][0-9]{1,2}$/;
/** More is a hostile file: the checker allows 300 terms and 20 categories. */
const MAX_TERMS = 300;

function category(input: unknown, path: string): SiteGlossaryCategory {
  const o = object(input, path);
  return { id: matching(o, 'id', path, TERM_ID), label: str(o, 'label', path) };
}

function term(input: unknown, path: string): SiteGlossaryTerm {
  const o = object(input, path);
  return {
    id: matching(o, 'id', path, TERM_ID),
    title: str(o, 'title', path),
    category: matching(o, 'category', path, TERM_ID),
    definition: blocks(field(o, 'definition'), `${path}.definition`),
    see: listField(o, 'see', path, (v, p) => {
      if (typeof v !== 'string' || !TERM_ID.test(v)) fail(p, 'a term id');
      return v;
    }),
    lessons: listField(o, 'lessons', path, (v, p) => {
      const l: Fields = object(v, p);
      return { id: matching(l, 'id', p, LESSON_ID), title: str(l, 'title', p) };
    }),
  };
}

function glossary(input: unknown, language: string): SiteGlossary {
  const o = object(input, '');
  if (field(o, 'format') !== GLOSSARY_FORMAT) fail('format', `format ${String(GLOSSARY_FORMAT)}`);
  if (field(o, 'language') !== language || !LANGUAGE.test(language))
    fail('language', `the language ${language}`);
  const categories = list(field(o, 'categories'), 'categories', category);
  const terms = list(field(o, 'terms'), 'terms', term);
  if (terms.length > MAX_TERMS) fail('terms', `at most ${String(MAX_TERMS)} terms`);
  const ids = new Set(terms.map((t) => t.id));
  if (ids.size !== terms.length) fail('terms', 'each id once');
  const cats = new Set(categories.map((c) => c.id));
  terms.forEach((t, i) => {
    if (!cats.has(t.category)) fail(`terms[${String(i)}].category`, 'a listed category');
    if (t.see.some((s) => !ids.has(s)))
      fail(`terms[${String(i)}].see`, 'ids of terms in this glossary');
  });
  return { format: GLOSSARY_FORMAT, language, title: str(o, 'title', ''), categories, terms };
}

/** Reads a glossary file (hostile input, L0.2); a file of another language is bad data. */
export function readSiteGlossary(input: unknown, language: string): ReadResult<SiteGlossary> {
  return read(input, (value) => glossary(value, language));
}
