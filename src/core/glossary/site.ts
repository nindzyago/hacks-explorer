/**
 * The glossary as the site gets it (M2.4, K98; split into an index and chunks in CI3). Two kinds
 * of files per language, both loaded lazily, the first time a reader opens a term or the
 * glossary tab:
 *
 * - the index `data/glossary/<lang>.json` (`SiteGlossary`): the categories and, per term, its
 *   id, title, category and the number of the chunk that holds the rest. Enough for the list and
 *   its search, the «see also» titles and the category tag;
 * - the chunks `data/glossary/<lang>.<hash8>.json` (`SiteGlossaryChunk`): definitions, «see
 *   also» ids and related lessons of a run of terms, packed by the build to about
 *   `GLOSSARY_CHUNK_BYTES`. The index names each chunk by the hash of its text, so an index never
 *   pairs with a chunk of another build.
 *
 * Every chunk is at most `MAX_GLOSSARY_FILE_BYTES` however many definitions there are; only the
 * index grows with the number of terms, up to `MAX_GLOSSARY_INDEX_BYTES`. Definitions are text trees with terms already linked by
 * the build; no forms are shipped, the site never searches text (K31).
 *
 * This file and the readers below import nothing that pulls the Markdown parser.
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

export const GLOSSARY_FORMAT = 2;
/** Budget of one glossary file, index or chunk, as served (K98). */
export const MAX_GLOSSARY_FILE_BYTES = 30 * 1024;
/**
 * Budget of the index alone (G17): it grows with the number of terms, about 84 bytes a term, so
 * the cap of `MAX_GLOSSARY_TERMS` with ordinary titles is about 50 KB (12 KB in gzip). Chunks keep
 * `MAX_GLOSSARY_FILE_BYTES`.
 */
export const MAX_GLOSSARY_INDEX_BYTES = 60 * 1024;
/**
 * The build starts a new chunk before one would pass this many bytes, so opening a term fetches
 * at most about this much of definitions. One term is far smaller (a definition is at most 700
 * characters), so a chunk never passes the file budget.
 */
export const GLOSSARY_CHUNK_BYTES = 16 * 1024;

const LANGUAGE = /^[a-z]{2,3}$/;
const LESSON_ID = /^[A-Z][0-9]{1,2}$/;
const HASH = /^[0-9a-f]{8}$/;
/**
 * The most terms of one language (G17): the checker stops a glossary with more, the site treats
 * an index with more as hostile. About 84 bytes of index per term, so 600 terms fit the index
 * budget below with room for long titles.
 */
export const MAX_GLOSSARY_TERMS = 600;
const MAX_TERMS = MAX_GLOSSARY_TERMS;

/** The index of a language. */
export function glossaryFile(language: string): string {
  return `data/glossary/${language}.json`;
}

/** A chunk of definitions, named by the hash of its text. */
export function glossaryChunkFile(language: string, hash: string): string {
  return `data/glossary/${language}.${hash}.json`;
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

/** A term in the index. */
export interface SiteGlossaryEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  /** The position of its chunk in `SiteGlossary.chunks`. */
  readonly chunk: number;
}

/** The index file of a language. */
export interface SiteGlossary {
  readonly format: typeof GLOSSARY_FORMAT;
  readonly language: string;
  readonly title: string;
  readonly categories: readonly SiteGlossaryCategory[];
  readonly terms: readonly SiteGlossaryEntry[];
  /** The hash of each chunk file: `glossaryChunkFile(language, hash)`. */
  readonly chunks: readonly string[];
}

/** A term in a chunk: what the index does not carry. */
export interface SiteGlossaryDefinition {
  readonly id: string;
  readonly definition: readonly SiteBlock[];
  readonly see: readonly string[];
  readonly lessons: readonly SiteGlossaryLesson[];
}

/** A chunk file: the terms of the index whose `chunk` is this one, in index order. */
export interface SiteGlossaryChunk {
  readonly format: typeof GLOSSARY_FORMAT;
  readonly language: string;
  readonly terms: readonly SiteGlossaryDefinition[];
}

/** A whole term, as the popover and the glossary tab show it: index entry and chunk joined. */
export interface SiteGlossaryTerm {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly definition: readonly SiteBlock[];
  readonly see: readonly string[];
  readonly lessons: readonly SiteGlossaryLesson[];
}

function header(o: Fields, language: string): void {
  if (field(o, 'format') !== GLOSSARY_FORMAT) fail('format', `format ${String(GLOSSARY_FORMAT)}`);
  if (field(o, 'language') !== language || !LANGUAGE.test(language))
    fail('language', `the language ${language}`);
}

function category(input: unknown, path: string): SiteGlossaryCategory {
  const o = object(input, path);
  return { id: matching(o, 'id', path, TERM_ID), label: str(o, 'label', path) };
}

function entry(input: unknown, path: string): SiteGlossaryEntry {
  const o = object(input, path);
  const chunk = field(o, 'chunk');
  if (typeof chunk !== 'number' || !Number.isInteger(chunk) || chunk < 0)
    fail(`${path}.chunk`, 'a chunk number');
  return {
    id: matching(o, 'id', path, TERM_ID),
    title: str(o, 'title', path),
    category: matching(o, 'category', path, TERM_ID),
    chunk,
  };
}

function index(input: unknown, language: string): SiteGlossary {
  const o = object(input, '');
  header(o, language);
  const categories = list(field(o, 'categories'), 'categories', category);
  const terms = list(field(o, 'terms'), 'terms', entry);
  if (terms.length > MAX_TERMS) fail('terms', `at most ${String(MAX_TERMS)} terms`);
  const chunks = list(field(o, 'chunks'), 'chunks', (v, p) => {
    if (typeof v !== 'string' || !HASH.test(v)) fail(p, 'a chunk hash');
    return v;
  });
  if (chunks.length > MAX_TERMS) fail('chunks', `at most ${String(MAX_TERMS)} chunks`);
  if (new Set(chunks).size !== chunks.length) fail('chunks', 'each chunk once');
  const ids = new Set(terms.map((t) => t.id));
  if (ids.size !== terms.length) fail('terms', 'each id once');
  const cats = new Set(categories.map((c) => c.id));
  terms.forEach((t, i) => {
    if (!cats.has(t.category)) fail(`terms[${String(i)}].category`, 'a listed category');
    if (t.chunk >= chunks.length) fail(`terms[${String(i)}].chunk`, 'a listed chunk');
  });
  return {
    format: GLOSSARY_FORMAT,
    language,
    title: str(o, 'title', ''),
    categories,
    terms,
    chunks,
  };
}

/** Reads a glossary index (hostile input, L0.2); a file of another language is bad data. */
export function readSiteGlossary(input: unknown, language: string): ReadResult<SiteGlossary> {
  return read(input, (value) => index(value, language));
}

function definition(input: unknown, path: string): SiteGlossaryDefinition {
  const o = object(input, path);
  return {
    id: matching(o, 'id', path, TERM_ID),
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

function chunkOf(input: unknown, glossary: SiteGlossary, n: number): SiteGlossaryChunk {
  const o = object(input, '');
  header(o, glossary.language);
  const terms = list(field(o, 'terms'), 'terms', definition);
  // Exactly the index's terms of this chunk, in its order: a cut, swapped or stale chunk is bad.
  const expected = glossary.terms.filter((t) => t.chunk === n).map((t) => t.id);
  if (terms.length !== expected.length || terms.some((t, i) => t.id !== expected[i]))
    fail('terms', `the terms of chunk ${String(n)} of the index`);
  const ids = new Set(glossary.terms.map((t) => t.id));
  terms.forEach((t, i) => {
    if (t.see.some((s) => !ids.has(s)))
      fail(`terms[${String(i)}].see`, 'ids of terms in this glossary');
  });
  return { format: GLOSSARY_FORMAT, language: glossary.language, terms };
}

/** Reads chunk `n` of `glossary` (hostile input, L0.2): exactly that chunk's terms, in order. */
export function readGlossaryChunk(
  input: unknown,
  glossary: SiteGlossary,
  n: number,
): ReadResult<SiteGlossaryChunk> {
  return read(input, (value) => chunkOf(value, glossary, n));
}

/** The whole term `id` from the index and its chunk (already read); undefined if not there. */
export function glossaryTerm(
  glossary: SiteGlossary,
  chunk: SiteGlossaryChunk,
  id: string,
): SiteGlossaryTerm | undefined {
  const head = glossary.terms.find((t) => t.id === id);
  const rest = chunk.terms.find((t) => t.id === id);
  if (head === undefined || rest === undefined) return undefined;
  return {
    id,
    title: head.title,
    category: head.category,
    definition: rest.definition,
    see: rest.see,
    lessons: rest.lessons,
  };
}
