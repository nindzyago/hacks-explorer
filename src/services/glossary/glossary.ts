/**
 * Loads the glossary of one language (`data/glossary/<lang>.json`, M2.4) the first time it is
 * needed: the first opened term. The file is hostile input (L0.2): the result is typed data or a
 * typed error, never an exception. A success is kept for the life of the loader; a failure is
 * not, so the next call tries again.
 */
import type { SiteGlossary } from '../../core/glossary/site';
import { glossaryFile, readSiteGlossary } from '../../core/glossary/site';
import type { FetchLike, Loaded } from '../catalog/catalog';
import { failure, fetchJson } from '../catalog/catalog';

export interface GlossaryLoader {
  glossary(language: unknown): Promise<Loaded<SiteGlossary>>;
}

const LANGUAGE = /^[a-z]{2,3}$/;

export function createGlossaryLoader(options: {
  readonly fetch: FetchLike;
  readonly base?: string;
}): GlossaryLoader {
  const base = options.base ?? '/';
  const kept = new Map<string, SiteGlossary>();
  const fetch: FetchLike = (url) => {
    try {
      return options.fetch(url);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('fetch failed'));
    }
  };
  return {
    async glossary(language) {
      if (typeof language !== 'string' || !LANGUAGE.test(language)) {
        return failure('not-found', 'no such language');
      }
      const known = kept.get(language);
      if (known !== undefined) return { ok: true, value: known };
      const url = `${base}${glossaryFile(language)}`;
      const json = await fetchJson(fetch, url);
      if (!json.ok) return json;
      const read = readSiteGlossary(json.value, language);
      if (!read.ok) return failure('bad-data', `${url}: ${read.error.message}`);
      kept.set(language, read.value);
      return { ok: true, value: read.value };
    },
  };
}
