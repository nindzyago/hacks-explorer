/**
 * Loads the glossary of one language (M2.4; an index and chunks since CI3) the first time it is
 * needed: the index `data/glossary/<lang>.json` for the list, and for a term the chunk that holds
 * its definition, `data/glossary/<lang>.<hash>.json`. Every file is hostile input (L0.2): the
 * result is typed data or a typed error, never an exception. A success is kept for the life of
 * the loader and a request in flight is shared; a failure is not kept, so the next call tries
 * again.
 */
import type { SiteGlossary, SiteGlossaryChunk, SiteGlossaryTerm } from '../../core/glossary/site';
import {
  glossaryChunkFile,
  glossaryFile,
  glossaryTerm,
  readGlossaryChunk,
  readSiteGlossary,
} from '../../core/glossary/site';
import type { FetchLike, Loaded } from '../catalog/catalog';
import { failure, fetchJson } from '../catalog/catalog';

/** A term as the site shows it: the whole index (titles, categories) and the term, if any. */
export interface GlossaryView {
  readonly glossary: SiteGlossary;
  /** Null when the index has no such term. */
  readonly term: SiteGlossaryTerm | null;
}

export interface GlossaryLoader {
  /** The index of a language: categories and every term's id, title and category. */
  glossary(language: unknown): Promise<Loaded<SiteGlossary>>;
  /** The index and the whole term `id`, loading its chunk. */
  term(language: unknown, id: unknown): Promise<Loaded<GlossaryView>>;
  /** The same, when the index and the term's chunk are already here; else undefined. */
  known(language: unknown, id: unknown): GlossaryView | undefined;
}

const LANGUAGE = /^[a-z]{2,3}$/;
const TERM_ID = /^[a-z][a-z0-9-]{0,31}$/;

export function createGlossaryLoader(options: {
  readonly fetch: FetchLike;
  readonly base?: string;
}): GlossaryLoader {
  const base = options.base ?? '/';
  /** Index per language; chunk per `<language>.<hash>`. Promises: a request in flight is shared. */
  const indexes = new Map<string, Promise<Loaded<SiteGlossary>>>();
  const chunks = new Map<string, Promise<Loaded<SiteGlossaryChunk>>>();
  const keptIndexes = new Map<string, SiteGlossary>();
  const keptChunks = new Map<string, SiteGlossaryChunk>();
  const fetch: FetchLike = (url) => {
    try {
      return options.fetch(url);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('fetch failed'));
    }
  };

  async function loadIndex(language: string): Promise<Loaded<SiteGlossary>> {
    const url = `${base}${glossaryFile(language)}`;
    const json = await fetchJson(fetch, url);
    if (!json.ok) return json;
    const read = readSiteGlossary(json.value, language);
    if (!read.ok) return failure('bad-data', `${url}: ${read.error.message}`);
    keptIndexes.set(language, read.value);
    return { ok: true, value: read.value };
  }

  function index(language: string): Promise<Loaded<SiteGlossary>> {
    const known = indexes.get(language);
    if (known !== undefined) return known;
    const loading = loadIndex(language).then((result) => {
      if (!result.ok) indexes.delete(language);
      return result;
    });
    indexes.set(language, loading);
    return loading;
  }

  async function loadChunk(
    glossary: SiteGlossary,
    n: number,
    hash: string,
  ): Promise<Loaded<SiteGlossaryChunk>> {
    const url = `${base}${glossaryChunkFile(glossary.language, hash)}`;
    const json = await fetchJson(fetch, url);
    if (!json.ok) return json;
    const read = readGlossaryChunk(json.value, glossary, n);
    if (!read.ok) return failure('bad-data', `${url}: ${read.error.message}`);
    keptChunks.set(`${glossary.language}.${hash}`, read.value);
    return { ok: true, value: read.value };
  }

  function chunk(glossary: SiteGlossary, n: number): Promise<Loaded<SiteGlossaryChunk>> {
    const hash = glossary.chunks[n];
    if (hash === undefined) return Promise.resolve(failure('bad-data', 'no such chunk'));
    const key = `${glossary.language}.${hash}`;
    const known = chunks.get(key);
    if (known !== undefined) return known;
    const loading = loadChunk(glossary, n, hash).then((result) => {
      if (!result.ok) chunks.delete(key);
      return result;
    });
    chunks.set(key, loading);
    return loading;
  }

  /** A language and a term id as they may be asked for, or null for anything else. */
  function asked(
    language: unknown,
    id: unknown,
  ): { readonly language: string; readonly id: string } | null {
    return typeof language === 'string' &&
      LANGUAGE.test(language) &&
      typeof id === 'string' &&
      TERM_ID.test(id)
      ? { language, id }
      : null;
  }

  return {
    glossary(language) {
      if (typeof language !== 'string' || !LANGUAGE.test(language)) {
        return Promise.resolve(failure('not-found', 'no such language'));
      }
      return index(language);
    },

    async term(language, termId) {
      const a = asked(language, termId);
      if (a === null) return failure('not-found', 'no such language or term');
      const { id } = a;
      const glossary = await index(a.language);
      if (!glossary.ok) return glossary;
      const entry = glossary.value.terms.find((t) => t.id === id);
      if (entry === undefined) return { ok: true, value: { glossary: glossary.value, term: null } };
      const loaded = await chunk(glossary.value, entry.chunk);
      if (!loaded.ok) return loaded;
      const term = glossaryTerm(glossary.value, loaded.value, id) ?? null;
      return { ok: true, value: { glossary: glossary.value, term } };
    },

    known(language, termId) {
      const a = asked(language, termId);
      if (a === null) return undefined;
      const { id } = a;
      const glossary = keptIndexes.get(a.language);
      if (glossary === undefined) return undefined;
      const entry = glossary.terms.find((t) => t.id === id);
      if (entry === undefined) return { glossary, term: null };
      const hash = glossary.chunks[entry.chunk];
      const kept = hash === undefined ? undefined : keptChunks.get(`${a.language}.${hash}`);
      if (kept === undefined) return undefined;
      return { glossary, term: glossaryTerm(glossary, kept, id) ?? null };
    },
  };
}
