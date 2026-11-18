// M1.1b, oracle level D: B1 loads from the built data (`dist-e2e/data/`), fetched by the page
// itself under the site's CSP (`connect-src 'self'`), and read by the site's loader.
import type { Page } from '@playwright/test';
import type { FetchLike } from '../src/services/catalog/catalog';
import { createLessonLoader } from '../src/services/catalog/catalog';
import { expect, openApp, test } from './support';

/** `fetch` run inside the page, so the browser's CSP and the static server both apply. */
function pageFetch(page: Page): FetchLike {
  return async (url) => {
    const response = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return { ok: r.ok, status: r.status, body: await r.text() };
    }, url);
    return { ok: response.ok, status: response.status, text: () => Promise.resolve(response.body) };
  };
}

test('B1 loads from the built data', async ({ page }) => {
  await openApp(page);
  const loader = createLessonLoader({ fetch: pageFetch(page) });

  const catalog = await loader.catalog();
  if (!catalog.ok) throw new Error(catalog.error.message);
  const entry = catalog.value.lessons.find((l) => l.id === 'B1');
  expect(entry?.translations.map((t) => t.language)).toContain('ru');

  const lesson = await loader.lesson('B1', 'ru');
  if (!lesson.ok) throw new Error(lesson.error.message);
  expect(lesson.value.title).toBe('SQL-инъекция');
  expect(lesson.value.steps.length).toBeGreaterThan(3);
  expect(lesson.value.steps[0]?.levels.simple[0]?.type).toBe('paragraph');
});

test('a lesson that is not there is an error, not a crash', async ({ page }) => {
  await openApp(page);
  const loader = createLessonLoader({ fetch: pageFetch(page) });
  expect(await loader.lesson('Z9', 'ru')).toMatchObject({
    ok: false,
    error: { code: 'not-found' },
  });
});
