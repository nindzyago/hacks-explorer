// G18: the lessons every lesson-generic browser check runs over, and their built data. The list
// comes from `content/lessons/` (a folder with a Russian and an English file is a lesson), so a
// new lesson is played by the scene, phone, axe, S1–S3 and one-screen checks without a change
// here. What a check expects of a lesson (its steps, modes, stopped steps, names) is read from
// the built lesson file the site itself loads, never copied into the test.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { SiteLesson } from '../src/core/lesson/site';
import type { FetchLike } from '../src/services/catalog/catalog';
import { createLessonLoader } from '../src/services/catalog/catalog';

export const LANGS = ['ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const ROOT = join(process.cwd(), 'content', 'lessons');

/** Every lesson in `content/lessons/` with both a Russian and an English file, sorted by id. */
export const LESSONS: readonly string[] = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((id) => LANGS.every((lang) => existsSync(join(ROOT, id, `${lang}.md`))))
  .sort();

if (LESSONS.length === 0) throw new Error(`no lessons in ${ROOT}`);

/** `fetch` run inside the page, so the browser's CSP and the static server both apply. */
export function pageFetch(page: Page): FetchLike {
  return async (url) => {
    const response = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return {
        ok: r.ok,
        status: r.status,
        length: r.headers.get('content-length'),
        body: await r.text(),
      };
    }, url);
    return {
      ok: response.ok,
      status: response.status,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-length' ? response.length : null),
      },
      text: () => Promise.resolve(response.body),
    };
  };
}

/** The built lesson `id` in `lang`, loaded by the site's own loader inside the page. */
export async function lessonData(page: Page, id: string, lang: Lang): Promise<SiteLesson> {
  const result = await createLessonLoader({ fetch: pageFetch(page) }).lesson(id, lang);
  if (!result.ok) throw new Error(`${id} ${lang}: ${result.error.message}`);
  return result.value;
}

/** Text with every run of white space made one space, trimmed. */
export const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Whether `text` (a drawn piece of text) is written that way in the lesson: part of one of its
 * strings. An «…» the author wrote (`session=…anna…` in a code box) is not text cut by the site.
 */
export function authored(lesson: SiteLesson, text: string): boolean {
  const strings: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') strings.push(squash(v));
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) walk(x);
  };
  walk(lesson);
  const want = squash(text);
  return strings.some((s) => s.includes(want));
}

/** Opens lesson `id` on the open page through the control channel and waits for its scene. */
export async function switchLesson(page: Page, id: string): Promise<void> {
  const result = await page.evaluate(
    (i) => window.__app?.commands.run('lesson.open', { id: i }),
    id,
  );
  if (result?.ok !== true) throw new Error(`lesson.open ${id}: ${JSON.stringify(result)}`);
  await page.waitForFunction(
    (i) => document.querySelector('[data-testid="scene"]')?.getAttribute('data-lesson') === i,
    id,
  );
}
