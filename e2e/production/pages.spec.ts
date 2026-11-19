// M4.3 (scenario S4, oracle level D): link previews and search engines that do not run scripts
// get each lesson's own title, description and card from the HTML the server sends; the same
// address then boots the app as before. The sitemap lists every page in every language.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { sayFromFile } from '../../src/core/i18n/testing';
import { lessonDescription, pageTitle } from '../../src/core/meta/meta';
import { SITE_ORIGIN } from '../../scripts/site-pages';
import { readSiteLesson } from '../../src/core/lesson/site-read';
import { expect, sceneReady, test } from '../support';

/** The lesson as the production build ships it. */
function built(id: string, language: string) {
  const dir = join('dist', 'data', 'lessons');
  const name = readdirSync(dir).find((n) => n.startsWith(`${id}.${language}.`));
  if (name === undefined) throw new Error(`no ${id}.${language} in ${dir}`);
  const lesson = readSiteLesson(JSON.parse(readFileSync(join(dir, name), 'utf8')), {
    id,
    language,
  });
  if (!lesson.ok) throw new Error(lesson.error.message);
  return lesson.value;
}

async function withoutScripts<T>(browser: Browser, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    return await run(await context.newPage());
  } finally {
    await context.close();
  }
}

const head = (page: Page, selector: string, attribute = 'content') =>
  page.locator(`head ${selector}`).getAttribute(attribute);

for (const [id, lang] of [
  ['K1', 'ru'],
  ['K1', 'en'],
  ['B1', 'ru'],
] as const) {
  test(`without scripts, /${lang}/lesson/${id} has its own title, description and card`, async ({
    browser,
    request,
  }) => {
    const lesson = built(id, lang);
    const description = lessonDescription(lesson.passport, sayFromFile(lang));
    expect(description).not.toBeNull();
    const url = `${SITE_ORIGIN}/${lang}/lesson/${id}`;
    const card = `${SITE_ORIGIN}/cards/${id}.${lang}.png`;

    await withoutScripts(browser, async (page) => {
      const response = await page.goto(`/${lang}/lesson/${id}`);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(pageTitle(lesson.title));
      expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      expect(await head(page, 'meta[name="description"]')).toBe(description);
      expect(await head(page, 'meta[property="og:title"]')).toBe(lesson.title);
      expect(await head(page, 'meta[property="og:description"]')).toBe(description);
      expect(await head(page, 'meta[property="og:url"]')).toBe(url);
      expect(await head(page, 'meta[property="og:image"]')).toBe(card);
      expect(await head(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(await head(page, 'meta[name="twitter:image"]')).toBe(card);
      expect(await head(page, 'link[rel="canonical"]', 'href')).toBe(url);
      expect(await head(page, 'link[hreflang="x-default"]', 'href')).toBe(
        `${SITE_ORIGIN}/ru/lesson/${id}`,
      );
      await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
    });

    // The card is served by the site itself: a PNG of 1200×630 within 100 KB.
    const image = await request.get(`/cards/${id}.${lang}.png`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
    const bytes = await image.body();
    expect(bytes.length).toBeLessThanOrEqual(100 * 1024);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });
}

test('without scripts, «About» has its title and the site card', async ({ browser }) => {
  await withoutScripts(browser, async (page) => {
    await page.goto('/en/about');
    await expect(page).toHaveTitle('About — Hacks Explorer');
    expect(await head(page, 'meta[property="og:image"]')).toBe(`${SITE_ORIGIN}/cards/about.en.png`);
    expect(await head(page, 'link[rel="canonical"]', 'href')).toBe(`${SITE_ORIGIN}/en/about`);
  });
});

test('an unknown address still gets the app page, with no canonical of another page', async ({
  browser,
}) => {
  await withoutScripts(browser, async (page) => {
    await page.goto('/ru/lesson/Z9');
    await expect(page).toHaveTitle('Hacks Explorer');
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
    expect(await head(page, 'meta[property="og:image"]')).toBe(`${SITE_ORIGIN}/cards/about.ru.png`);
  });
});

test('the static page of a lesson boots the app at the place in its address', async ({ page }) => {
  const lesson = built('K1', 'en');
  await page.goto('/en/lesson/K1#step-2-defence');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'K1');
  await expect(page.getByTestId('player-status')).toHaveText(/^Step 2 of \d+$/);
  await expect(page.getByTestId('defence-toggle')).toHaveAttribute('data-defence', 'true');
  await sceneReady(page);
  // The page the app keeps says the same as the one the server sent.
  await expect(page).toHaveTitle(pageTitle(lesson.title));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    lessonDescription(lesson.passport, sayFromFile('en')) ?? '',
  );
  await page.getByTestId('player-next').click();
  await expect(page).toHaveURL(/\/en\/lesson\/K1#step-3-defence$/);
  await page.reload();
  await expect(page.getByTestId('player-status')).toHaveText(/^Step 3 of \d+$/);
});

test('sitemap.xml is valid XML with every page in every language and its alternates', async ({
  page,
  request,
}) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');
  const xml = await response.text();
  await page.goto('/');
  const read = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    const XHTML = 'http://www.w3.org/1999/xhtml';
    return {
      error: doc.getElementsByTagName('parsererror').length,
      root: `${doc.documentElement.namespaceURI ?? ''} ${doc.documentElement.localName}`,
      urls: Array.from(doc.getElementsByTagNameNS(NS, 'url')).map((url) => ({
        loc: url.getElementsByTagNameNS(NS, 'loc')[0]?.textContent ?? '',
        alternates: Array.from(url.getElementsByTagNameNS(XHTML, 'link')).map(
          (link) => `${link.getAttribute('hreflang') ?? ''} ${link.getAttribute('href') ?? ''}`,
        ),
      })),
    };
  }, xml);
  expect(read.error).toBe(0);
  expect(read.root).toBe('http://www.sitemaps.org/schemas/sitemap/0.9 urlset');
  // 10 lessons and «About», in Russian and English.
  expect(read.urls).toHaveLength(22);
  const locs = read.urls.map((u) => u.loc);
  expect(new Set(locs).size).toBe(22);
  expect(locs).toContain(`${SITE_ORIGIN}/ru/lesson/K1`);
  expect(locs).toContain(`${SITE_ORIGIN}/en/about`);
  for (const url of read.urls) {
    const path = url.loc.replace(/^https:\/\/[^/]+\/(ru|en)/, '');
    expect(url.alternates).toEqual([
      `ru ${SITE_ORIGIN}/ru${path}`,
      `en ${SITE_ORIGIN}/en${path}`,
      `x-default ${SITE_ORIGIN}/ru${path}`,
    ]);
  }

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
});
