/**
 * Loads the topics of one language (`data/topics/<lang>.json`, M2.1b, K112) the first time the
 * lessons panel opens. The file is hostile input (L0.2): the result is typed data or a typed
 * error, never an exception. A success is kept for the life of the loader; a failure is not, so
 * the next call tries again.
 */
import type { SiteTopics } from '../../core/topics/site';
import { readSiteTopics, topicsFile } from '../../core/topics/site';
import type { FetchLike, Loaded } from '../catalog/catalog';
import { failure, fetchJson } from '../catalog/catalog';

export interface TopicsLoader {
  topics(language: unknown): Promise<Loaded<SiteTopics>>;
}

const LANGUAGE = /^[a-z]{2,3}$/;

export function createTopicsLoader(options: {
  readonly fetch: FetchLike;
  readonly base?: string;
}): TopicsLoader {
  const base = options.base ?? '/';
  const kept = new Map<string, SiteTopics>();
  const fetch: FetchLike = (url) => {
    try {
      return options.fetch(url);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('fetch failed'));
    }
  };
  return {
    async topics(language) {
      if (typeof language !== 'string' || !LANGUAGE.test(language)) {
        return failure('not-found', 'no such language');
      }
      const known = kept.get(language);
      if (known !== undefined) return { ok: true, value: known };
      const url = `${base}${topicsFile(language)}`;
      const json = await fetchJson(fetch, url);
      if (!json.ok) return json;
      const read = readSiteTopics(json.value, language);
      if (!read.ok) return failure('bad-data', `${url}: ${read.error.message}`);
      kept.set(language, read.value);
      return { ok: true, value: read.value };
    },
  };
}
