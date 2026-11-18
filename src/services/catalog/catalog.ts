/**
 * Loads the lesson catalog and lessons that the build wrote to `data/` (decision K37). Every
 * file is hostile input (L0.2): the result is typed data or a typed error, never an exception.
 * See README.md.
 */
import type { SiteCatalog, SiteLesson } from '../../core/lesson/site';
import { CATALOG_FILE, lessonFile } from '../../core/lesson/site';
import type { ReadResult } from '../../core/lesson/site-read';
import { readCatalog, readSiteLesson } from '../../core/lesson/site-read';

/** The part of `fetch` the loader uses; `window.fetch` fits, tests pass their own. */
export type FetchLike = (url: string) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}>;

export interface LoadError {
  /**
   * `not-found`: no such lesson or language in the catalog, or the server has no such file;
   * `network`: the request failed or the server answered with an error;
   * `bad-data`: the file is not what the build writes (cut off, corrupted, swapped).
   */
  readonly code: 'not-found' | 'network' | 'bad-data';
  /** English, for logs and the error message on screen. */
  readonly message: string;
}

export type Loaded<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: LoadError };

export interface LessonLoader {
  catalog(): Promise<Loaded<SiteCatalog>>;
  /** `id` and `language` may be anything (they come from the address); only catalog entries load. */
  lesson(id: unknown, language: unknown): Promise<Loaded<SiteLesson>>;
}

/** Larger files are bad data unread: a lesson is at most 30 KB, the catalog a few. */
const MAX_FILE_CHARS = 128 * 1024;

function failure(code: LoadError['code'], message: string): { ok: false; error: LoadError } {
  return { ok: false, error: { code, message } };
}

async function fetchJson(fetch: FetchLike, url: string): Promise<Loaded<unknown>> {
  let body: string;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return response.status === 404
        ? failure('not-found', `${url}: not found`)
        : failure('network', `${url}: the server answered ${String(response.status)}`);
    }
    body = await response.text();
  } catch {
    return failure('network', `${url}: the request failed`);
  }
  if (body.length > MAX_FILE_CHARS) return failure('bad-data', `${url}: the file is too large`);
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return failure('bad-data', `${url}: not JSON`);
  }
}

function checked<T>(url: string, result: ReadResult<T>): Loaded<T> {
  return result.ok ? result : failure('bad-data', `${url}: ${result.error.message}`);
}

/**
 * `base` is the site's base path (`import.meta.env.BASE_URL`), `/` by default. Successful
 * results are kept for the life of the loader; failures are not, so a later call retries.
 */
export function createLessonLoader(options: {
  readonly fetch: FetchLike;
  readonly base?: string;
}): LessonLoader {
  const base = options.base ?? '/';
  const fetch: FetchLike = (url) => {
    try {
      return options.fetch(url);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('fetch failed'));
    }
  };
  let catalog: SiteCatalog | null = null;
  const lessons = new Map<string, SiteLesson>();

  async function loadCatalog(): Promise<Loaded<SiteCatalog>> {
    if (catalog !== null) return { ok: true, value: catalog };
    const url = `${base}${CATALOG_FILE}`;
    const json = await fetchJson(fetch, url);
    if (!json.ok) return json;
    const result = checked(url, readCatalog(json.value));
    if (result.ok) catalog = result.value;
    return result;
  }

  async function loadLesson(id: unknown, language: unknown): Promise<Loaded<SiteLesson>> {
    const index = await loadCatalog();
    if (!index.ok) return index;
    const entry = index.value.lessons.find((l) => l.id === id);
    const translation = entry?.translations.find((t) => t.language === language);
    if (entry === undefined || translation === undefined) {
      return failure('not-found', 'no such lesson in this language');
    }
    const key = `${entry.id}.${translation.language}`;
    const kept = lessons.get(key);
    if (kept !== undefined) return { ok: true, value: kept };
    const url = `${base}${lessonFile(entry.id, translation.language, translation.hash)}`;
    const json = await fetchJson(fetch, url);
    if (!json.ok) return json;
    const result = checked(
      url,
      readSiteLesson(json.value, { id: entry.id, language: translation.language }),
    );
    if (result.ok) lessons.set(key, result.value);
    return result;
  }

  return { catalog: loadCatalog, lesson: loadLesson };
}
