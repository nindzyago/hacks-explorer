// M3.9 acceptance (oracle C R9 for the look, D for the rest): the page «About» on ru and en at
// `/<lang>/about`; the home page still opens a lesson (K7); the top bar leads to the page and back
// to the same place in the lesson, by mouse and by keyboard; the list of ready lessons is the
// topics of the language with a lesson file; title, description and language of the page follow
// it; axe WCAG 2.2 AA finds nothing; on laptops and phones nothing scrolls sideways and the top
// bar stays one row on a laptop. Screenshots go to ABOUT_SHOTS when it names a folder.
import AxeBuilder from '@axe-core/playwright';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, openApp, test } from './support';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const LOCALES = ['ru', 'en'] as const;
const TITLE = { ru: 'О проекте', en: 'About' } as const;
const BACK = { ru: 'К урокам', en: 'Back to lessons' } as const;

async function axe(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const found = result.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(found, label).toEqual([]);
}

async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ animations: 'disabled', caret: 'hide', path, fullPage: false });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['ABOUT_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

/** Every drawn element that sticks out past the left or right edge, and the page's own overflow. */
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const width = window.innerWidth;
    const root = document.documentElement;
    if (root.scrollWidth > width) out.push(`page ${String(root.scrollWidth)} > ${String(width)}`);
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > width + 0.5 || box.left < -0.5) {
        out.push(`${el.tagName.toLowerCase()} ${el.getAttribute('data-testid') ?? ''}`);
      }
    }
    return out;
  });
}

/** The ids of the ready topics of a language, from the data the site itself loads. */
/**
 * The top bar is one row: it is no taller than its tallest item (CI5: it used to be squeezed to
 * 36 px with its 46 px brand spilling out, so a height limit of 45 px passed with a hidden row).
 */
async function topBarRows(page: Page): Promise<{ bar: number; tallest: number }> {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid="topbar"]');
    if (bar === null) return { bar: 0, tallest: -1 };
    const items = Array.from(bar.children).map((e) => e.getBoundingClientRect().height);
    return { bar: bar.getBoundingClientRect().height, tallest: Math.max(...items) };
  });
}

async function readyTopics(page: Page, lang: string): Promise<string[]> {
  return page.evaluate(async (l) => {
    const response = await fetch(`/data/topics/${l}.json`);
    const data = (await response.json()) as {
      sections: { topics: { id: string; ready: boolean }[] }[];
    };
    return data.sections.flatMap((s) => s.topics.filter((t) => t.ready).map((t) => t.id));
  }, lang);
}

async function openAbout(page: Page, lang: string): Promise<void> {
  await page.goto(`/${lang}/about`);
  await expect(page.getByTestId('about')).toBeVisible();
  await expect(page.getByTestId('about-lesson').first()).toBeVisible();
}

for (const lang of LOCALES) {
  test(`${lang}: the page, its title, description, language and ready lessons`, async ({
    page,
  }) => {
    await openAbout(page, lang);
    await expect(page.getByTestId('about-title')).toHaveText(TITLE[lang]);
    await expect(page.getByTestId('about-title')).toBeFocused();
    await expect(page).toHaveTitle(`${TITLE[lang]} — Hacks Explorer`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Hacks Explorer');
    expect(page.url()).toMatch(new RegExp(`/${lang}/about$`));
    // No lesson is loaded behind the page and no scene is drawn.
    await expect(page.getByTestId('scene')).toHaveCount(0);

    const want = await readyTopics(page, lang);
    expect(want.length).toBeGreaterThan(0);
    const links = page.getByTestId('about-lesson');
    expect(await links.evaluateAll((all) => all.map((a) => a.getAttribute('data-topic')))).toEqual(
      want,
    );
    for (const id of want) {
      await expect(
        page.locator(`[data-testid="about-lesson"][data-topic="${id}"]`),
      ).toHaveAttribute('href', `/${lang}/lesson/${id}`);
    }
    const text = await page.getByTestId('about').innerText();
    for (const word of ['Protocol Explorer', 'MIT', 'CC BY-SA 4.0', 'OWASP', 'RFC 5737']) {
      expect(text).toContain(word);
    }
    if (lang === 'en') {
      expect(await page.locator('body').innerText()).not.toMatch(/[Ѐ-ӿ]/);
    }
  });
}

test('the home page still opens the lesson «Фишинг» (K7), with the way to «About»', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
  await expect(page.getByTestId('nav-about')).toHaveText('О проекте');
  await expect(page.getByTestId('nav-about')).toHaveAttribute('href', '/ru/about');
});

test('from the top bar to «About» and back to the same place, Back and Forward', async ({
  page,
}) => {
  await openApp(page, '/ru/lesson/B1#step-3');
  await page.getByTestId('nav-about').click();
  await expect(page).toHaveURL(/\/ru\/about$/);
  await expect(page.getByTestId('about')).toBeVisible();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  // The player keys sleep on the page.
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__app?.state.get().player.playing)).toBe(false);

  await expect(page.getByTestId('nav-lessons')).toHaveText(BACK.ru);
  await page.getByTestId('nav-lessons').click();
  await expect(page).toHaveURL(/\/ru\/lesson\/B1#step-3$/);
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'B1');
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 5');

  await page.goBack();
  await expect(page.getByTestId('about')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'B1');
});

test('the keyboard reaches «About» from the top bar and the lessons on it', async ({ page }) => {
  await openApp(page, '/en/lesson/I1');
  await page.locator('body').focus();
  // M6.1: on a wide screen the section chips and the search come before it.
  let found = false;
  for (let i = 0; i < 30 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = await page.getByTestId('nav-about').evaluate((el) => el === document.activeElement);
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.getByTestId('about-title')).toBeFocused();

  await page.getByTestId('about-lesson').first().focus();
  const id = await page.getByTestId('about-lesson').first().getAttribute('data-topic');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/en/lesson/${id ?? 'none'}$`));
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', id ?? 'none');
});

test('the language switch keeps the page; Back brings the other language back', async ({
  page,
}) => {
  await openAbout(page, 'ru');
  await page.getByTestId('language-en').click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.getByTestId('about-title')).toHaveText(TITLE.en);
  await expect(page).toHaveTitle('About — Hacks Explorer');
  await page.goBack();
  await expect(page.getByTestId('about-title')).toHaveText(TITLE.ru);
});

test('the lessons panel opens a lesson from the page', async ({ page }) => {
  await openAbout(page, 'ru');
  await page.getByTestId('open-lessons').click();
  await page.locator('[data-testid="catalog-open"]').first().click();
  await expect(page.getByTestId('scene')).toBeVisible();
  await expect(page).toHaveURL(/\/ru\/lesson\/[A-L][0-9]+$/);
});

test('hostile addresses around the page are «no such page»', async ({ page }) => {
  for (const bad of ['/ru/about/x', '/about', '/ru/%61bout', '/ru/aboutx']) {
    await page.goto(bad);
    await expect(page.getByTestId('page-not-found'), bad).toBeVisible();
    await expect(page.getByTestId('about')).toHaveCount(0);
  }
});

test('the list of lessons cannot load: a message and «Try again» (L0.1)', async ({ page }) => {
  let fail = true;
  await page.route('**/data/topics/en.json', async (route) => {
    if (fail) await route.fulfill({ status: 200, body: '{"format":1,"language":"ru"}' });
    else await route.continue();
  });
  await page.goto('/en/about');
  await expect(page.getByTestId('about-lessons').getByRole('alert')).toContainText(
    'The list of lessons could not be loaded.',
  );
  fail = false;
  await page.getByTestId('about-lessons').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('about-lesson').first()).toBeVisible();
});

for (const lang of LOCALES) {
  test(`${lang}: axe finds no WCAG A/AA violations on the page, wide and on a phone`, async ({
    page,
  }) => {
    await openAbout(page, lang);
    await axe(page, `${lang} about 1280`);
    await page.setViewportSize({ width: 360, height: 800 });
    await axe(page, `${lang} about 360`);
  });
}

const SCREENS = [
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 720 },
  { name: '360', width: 360, height: 800 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
] as const;

for (const screen of SCREENS) {
  test.describe(`at ${screen.name}`, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } });
    for (const lang of LOCALES) {
      test(`${lang}: nothing scrolls sideways on the page or on the lesson with the new link`, async ({
        page,
      }, testInfo) => {
        await openAbout(page, lang);
        expect(await sideways(page), 'about').toEqual([]);
        await keep(page, testInfo, `about-${lang}-${screen.name}`);
        if (screen.width >= 1024) {
          // A laptop: the top bar of the lesson stays one row with the new link.
          for (const topic of ['I1', 'B1']) {
            await openApp(page, `/${lang}/lesson/${topic}`);
            const rows = await topBarRows(page);
            expect(rows.tallest, topic).toBeGreaterThan(0);
            expect(rows.bar, topic).toBeLessThanOrEqual(rows.tallest + 0.5);
          }
        } else {
          await openApp(page, `/${lang}/lesson/I1`);
        }
        expect(await sideways(page), 'lesson').toEqual([]);
        await keep(page, testInfo, `lesson-${lang}-${screen.name}`);
      });
    }
  });
}
