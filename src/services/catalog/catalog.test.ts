// M1.1b, oracle level D: the loader fetches the catalog and a lesson; corrupted, swapped or
// missing data gives a typed error, never an exception (L0.2).
import { describe, expect, it } from 'vitest';
import { checkLesson } from '../../core/lesson/check';
import validRu from '../../core/lesson/fixtures/valid-ru.md?raw';
import type { SiteCatalog } from '../../core/lesson/site';
import { CATALOG_FILE, lessonFile, toSiteLesson } from '../../core/lesson/site';
import type { FetchLike } from './catalog';
import { createLessonLoader } from './catalog';

const checked = checkLesson('content/lessons/X1/ru.md', validRu, { sourceDomains: ['owasp.org'] });
if (checked.lesson === null) throw new Error(JSON.stringify(checked.errors));
const lesson = toSiteLesson(checked.lesson);
const HASH = '0123abcd';
const catalog: SiteCatalog = {
  format: 1,
  lessons: [
    {
      id: 'X1',
      section: 'X',
      wave: 2,
      translations: [{ language: 'ru', title: lesson.title, hash: HASH }],
    },
  ],
};

/** A fake server: path → body (a string) or a status code; records the requested urls. */
function server(files: Record<string, string | number | Error>) {
  const requested: string[] = [];
  const fetch: FetchLike = (url) => {
    requested.push(url);
    const body = Object.hasOwn(files, url) ? files[url] : 404;
    if (body instanceof Error) return Promise.reject(body);
    if (typeof body === 'number') {
      return Promise.resolve({ ok: false, status: body, text: () => Promise.resolve('') });
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body ?? '') });
  };
  return { fetch, requested };
}

const LESSON_URL = `/${lessonFile('X1', 'ru', HASH)}`;
const good = {
  [`/${CATALOG_FILE}`]: JSON.stringify(catalog),
  [LESSON_URL]: JSON.stringify(lesson),
};

describe('createLessonLoader', () => {
  it('loads the catalog and a lesson by id and language', async () => {
    const { fetch, requested } = server(good);
    const loader = createLessonLoader({ fetch });
    expect(await loader.catalog()).toEqual({ ok: true, value: catalog });
    expect(await loader.lesson('X1', 'ru')).toEqual({ ok: true, value: lesson });
    expect(requested).toEqual([`/${CATALOG_FILE}`, LESSON_URL]);
  });

  it('asks once: the catalog and lessons are kept', async () => {
    const { fetch, requested } = server(good);
    const loader = createLessonLoader({ fetch });
    await loader.lesson('X1', 'ru');
    await loader.lesson('X1', 'ru');
    await loader.catalog();
    expect(requested).toHaveLength(2);
  });

  it('uses the base path of the site', async () => {
    const { fetch, requested } = server({
      [`/sub/${CATALOG_FILE}`]: JSON.stringify(catalog),
      [`/sub${LESSON_URL}`]: JSON.stringify(lesson),
    });
    const result = await createLessonLoader({ fetch, base: '/sub/' }).lesson('X1', 'ru');
    expect(result.ok).toBe(true);
    expect(requested[1]).toBe(`/sub${LESSON_URL}`);
  });

  it('a lesson or language not in the catalog is not-found, without a request', async () => {
    const { fetch, requested } = server(good);
    const loader = createLessonLoader({ fetch });
    for (const [id, language] of [
      ['Z9', 'ru'],
      ['X1', 'en'],
      ['../X1', 'ru'],
      [undefined, 'ru'],
      ['X1', 42],
      ['__proto__', 'ru'],
      ['constructor', 'ru'],
    ] as const) {
      const result = await loader.lesson(id, language);
      expect(result).toMatchObject({ ok: false, error: { code: 'not-found' } });
    }
    expect(requested).toEqual([`/${CATALOG_FILE}`]);
  });

  it('a missing lesson file is not-found', async () => {
    const { fetch } = server({ [`/${CATALOG_FILE}`]: JSON.stringify(catalog) });
    const result = await createLessonLoader({ fetch }).lesson('X1', 'ru');
    expect(result).toMatchObject({ ok: false, error: { code: 'not-found' } });
  });

  it('a missing catalog is not-found; a failing server or network is network', async () => {
    expect(await createLessonLoader(server({})).catalog()).toMatchObject({
      ok: false,
      error: { code: 'not-found' },
    });
    expect(await createLessonLoader(server({ [`/${CATALOG_FILE}`]: 500 })).catalog()).toMatchObject(
      { ok: false, error: { code: 'network' } },
    );
    expect(
      await createLessonLoader(
        server({ [`/${CATALOG_FILE}`]: new TypeError('offline') }),
      ).catalog(),
    ).toMatchObject({ ok: false, error: { code: 'network' } });
  });

  it('a fetch that throws instead of rejecting is network', async () => {
    const loader = createLessonLoader({
      fetch: () => {
        throw new Error('boom');
      },
    });
    expect(await loader.catalog()).toMatchObject({ ok: false, error: { code: 'network' } });
  });

  it('retries after a failure instead of keeping it', async () => {
    const files: Record<string, string | number> = { [`/${CATALOG_FILE}`]: 503 };
    const loader = createLessonLoader(server(files));
    expect((await loader.catalog()).ok).toBe(false);
    files[`/${CATALOG_FILE}`] = JSON.stringify(catalog);
    expect((await loader.catalog()).ok).toBe(true);
  });

  const corrupt: [string, string][] = [
    ['not JSON', '{"format":1,'],
    ['the index.html a host answers for unknown paths', '<!doctype html><title>x</title>'],
    ['valid JSON of the wrong shape', '{"format":1,"steps":"x"}'],
    ['another lesson swapped in', JSON.stringify({ ...lesson, id: 'B2' })],
    ['a huge file', `"${'x'.repeat(200 * 1024)}"`],
    ['nested too deep for JSON.parse', `${'['.repeat(200_000)}${']'.repeat(200_000)}`],
  ];
  it.each(corrupt)('a lesson file that is %s is bad-data', async (_, body) => {
    const loader = createLessonLoader(server({ ...good, [LESSON_URL]: body }));
    expect(await loader.lesson('X1', 'ru')).toMatchObject({
      ok: false,
      error: { code: 'bad-data' },
    });
  });

  it('a corrupted catalog is bad-data, and so is a lesson asked through it', async () => {
    const loader = createLessonLoader(server({ ...good, [`/${CATALOG_FILE}`]: '[1,2' }));
    expect(await loader.catalog()).toMatchObject({ ok: false, error: { code: 'bad-data' } });
    expect(await loader.lesson('X1', 'ru')).toMatchObject({
      ok: false,
      error: { code: 'bad-data' },
    });
  });

  it('a text() that rejects is network', async () => {
    const loader = createLessonLoader({
      fetch: () =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error('cut')) }),
    });
    expect(await loader.catalog()).toMatchObject({ ok: false, error: { code: 'network' } });
  });
});
