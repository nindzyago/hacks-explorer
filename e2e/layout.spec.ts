// M6.1 acceptance (design M6 §2–4, K129): the blueprint screen of variant A «Три колонки».
// From 1280 px the lessons column is on the left without a click; at 1024 it is the side panel
// behind «☰ Уроки». The section chips of the column (UI2) and the search of the top bar filter
// the list; a step of the open lesson in the list goes to that step. The page is one screen at 1024, 1280 and 1440 on every lesson in
// both languages; a phone has one column. Screenshots go to M61_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { LANGS, LESSONS } from './lessons';
import { expect, openApp, sceneReady, test } from './support';

const TRAVEL_MS = 900;
const SHOT = { animations: 'disabled', caret: 'hide' } as const;

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function keep(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['M61_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

type Box = { x: number; y: number; width: number; height: number };
async function box(page: Page, id: string): Promise<Box> {
  const b = await page.getByTestId(id).first().boundingBox();
  if (b === null) throw new Error(`${id} is not drawn`);
  return b;
}

test.describe('the lessons column at 1280 and wider', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ] as const) {
    test.describe(`${String(viewport.width)}×${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('is there without a click, the open lesson unfolded with its steps', async ({
        page,
      }) => {
        await openApp(page, '/ru/lesson/B1');
        const side = page.getByTestId('lessons-panel');
        await expect(side).toBeVisible();
        await expect(page.getByTestId('open-lessons')).toHaveCount(0);
        await expect(page.getByTestId('drawer')).toHaveCount(0);
        // Every ready lesson is listed, the open one is marked and shows its steps.
        await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
        const open = side.locator('[data-testid="side-lesson"][data-topic="B1"]');
        await expect(open.getByTestId('side-open')).toHaveAttribute('aria-current', 'page');
        await expect(open.getByTestId('side-steps').locator('li')).toHaveCount(5);
        await expect(side.getByTestId('side-step-1')).toHaveAttribute('aria-current', 'step');
        // Left of the scene, through both rows: from the top of the scene to the bottom of the log.
        const [s, scene, log, explain] = await Promise.all([
          box(page, 'lessons-panel'),
          box(page, 'scene-panel'),
          box(page, 'log'),
          box(page, 'explain'),
        ]);
        expect(s.x + s.width).toBeLessThanOrEqual(scene.x);
        expect(Math.abs(s.y - scene.y)).toBeLessThan(2);
        expect(Math.abs(s.y + s.height - (log.y + log.height))).toBeLessThan(2);
        expect(s.width).toBeGreaterThan(280);
        expect(s.width).toBeLessThan(320);
        expect(explain.x).toBeGreaterThanOrEqual(scene.x + scene.width);
      });

      // CI5: on Linux the same fonts draw the brand 17 px wider than on macOS, the RU / EN switch
      // wrapped to a second row of the top bar and hid under the lessons column. The bar keeps
      // one row with room to spare (here 40 px of wider letters), and grows rather than overlaps.
      for (const lang of LANGS) {
        test(`${lang}: the top bar is one row even with wider letters; nothing covers it`, async ({
          page,
        }) => {
          await openApp(page, `/${lang}/lesson/B1`);
          await sceneReady(page);
          // Through the CSSOM: the site's CSP forbids inline style tags.
          await page.evaluate(() => {
            const brand = document.querySelector('[data-testid="topbar"] > :first-child');
            if (brand instanceof HTMLElement) brand.style.marginRight = '40px';
          });
          const [bar, side] = await Promise.all([box(page, 'topbar'), box(page, 'lessons-panel')]);
          for (const id of ['lesson-search', 'nav-about', 'languages']) {
            const b = await box(page, id);
            expect(b.y, id).toBeGreaterThanOrEqual(bar.y - 0.5);
            expect(b.y + b.height, id).toBeLessThanOrEqual(bar.y + bar.height + 0.5);
          }
          expect(bar.y + bar.height).toBeLessThan(side.y);
          // Clickable: no other element takes the pointer.
          const other = lang === 'ru' ? 'en' : 'ru';
          await page.getByTestId(`language-${other}`).click({ trial: true, timeout: 2000 });
        });
      }

      test('a step of the open lesson goes to that step; another lesson opens', async ({
        page,
      }) => {
        await openApp(page, '/ru/lesson/B1');
        await page.getByTestId('side-step-3').click();
        expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(3);
        await expect(page.getByTestId('side-step-3')).toHaveAttribute('aria-current', 'step');
        await expect(page.getByTestId('step-row-3')).toHaveAttribute('aria-current', 'step');
        await expect(page).toHaveURL(/\/ru\/lesson\/B1#step-3$/);
        // The steps follow the defence mode.
        await run(page, 'defence.set', { on: true });
        await expect(page.getByTestId('side-steps').locator('li')).toHaveCount(
          await page.getByTestId('steps-table').locator('tbody tr').count(),
        );
        await page.locator('[data-testid="side-lesson"][data-topic="C1"] a').click();
        await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'C1');
        await expect(
          page.locator('[data-testid="side-lesson"][data-topic="C1"] a'),
        ).toHaveAttribute('aria-current', 'page');
      });
    });
  }

  test.describe('filters', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    // UI2: the chips «Все» and one per section stand in the column, not in the top bar; the list
    // is grouped by section, ready lessons first, the topics still being written after them.
    test('the column lists every section; a section chip keeps one, «Все» shows all', async ({
      page,
    }) => {
      await openApp(page, '/ru/lesson/B1');
      const side = page.getByTestId('lessons-panel');
      await expect(page.getByTestId('topbar').locator('[data-testid^="section-"]')).toHaveCount(0);
      const chips = side.getByTestId('side-sections').getByRole('button');
      await expect(chips).toHaveCount(13);
      await expect(chips.first()).toHaveText('Все');
      await expect(side.getByTestId('side-section-all')).toHaveAttribute('aria-pressed', 'true');
      await expect(side.getByTestId('side-section-B')).toHaveText('Инъекции');
      await expect(side.getByTestId('side-section-B')).toHaveClass(/own/);
      await expect(side.getByTestId('side-section-B')).toHaveAttribute('aria-pressed', 'false');
      // Every section, A to L, each under its heading with «готово N из M».
      const groups = side.getByTestId('side-group');
      await expect(groups).toHaveCount(12);
      expect(await groups.evaluateAll((g) => g.map((e) => e.getAttribute('data-section')))).toEqual(
        'ABCDEFGHIJKL'.split(''),
      );
      const b = side.locator('[data-testid="side-group"][data-section="B"]');
      await expect(b.getByRole('heading')).toContainText('Веб: инъекции');
      await expect(b.getByTestId('side-count')).toHaveText(/^готово \d+ из \d+$/);
      // Ready lessons are links, first in their section; the rest are grey «скоро» after them.
      await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
      const soonCount = await side.getByTestId('side-soon').count();
      for (const group of await groups.all()) {
        const kinds = await group
          .locator('ul > li')
          .evaluateAll((li) => li.map((e) => e.getAttribute('data-testid')));
        expect(kinds.indexOf('side-lesson')).toBeLessThanOrEqual(0);
        const firstSoon = kinds.indexOf('side-soon');
        if (firstSoon >= 0)
          expect(kinds.slice(firstSoon).every((k) => k === 'side-soon')).toBe(true);
      }
      if (soonCount > 0)
        await expect(side.getByTestId('side-soon').first().locator('a')).toHaveCount(0);

      const inC = LESSONS.filter((id) => id.startsWith('C'));
      await side.getByTestId('side-section-C').click();
      await expect(side.getByTestId('side-section-C')).toHaveAttribute('aria-pressed', 'true');
      await expect(side.getByTestId('side-section-all')).toHaveAttribute('aria-pressed', 'false');
      await expect(groups).toHaveCount(1);
      await expect(groups).toHaveAttribute('data-section', 'C');
      await expect(side.getByTestId('side-lesson')).toHaveCount(inC.length);
      for (const topic of await side.locator('[data-topic]').all()) {
        expect(await topic.getAttribute('data-topic')).toMatch(/^C/);
      }
      await side.getByTestId('side-section-all').click();
      await expect(groups).toHaveCount(12);
      await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
    });

    test('the section chips wrap inside the column, in both languages', async ({ page }) => {
      for (const lang of LANGS) {
        await openApp(page, `/${lang}/lesson/B1`);
        const side = await box(page, 'lessons-panel');
        const chips = page.getByTestId('side-sections').getByRole('button');
        await expect(chips).toHaveCount(13);
        for (const chip of await chips.all()) {
          const b = await chip.boundingBox();
          if (b === null) throw new Error('a chip is not drawn');
          expect(b.x).toBeGreaterThanOrEqual(side.x);
          expect(b.x + b.width).toBeLessThanOrEqual(side.x + side.width + 0.5);
          expect(b.height).toBeGreaterThanOrEqual(24);
        }
      }
    });

    test('the search of the top bar filters the list, an empty result says so', async ({
      page,
    }) => {
      await openApp(page, '/ru/lesson/B1');
      const side = page.getByTestId('lessons-panel');
      await page.getByTestId('lesson-search').fill('csrf');
      await expect(side.getByTestId('side-lesson')).toHaveCount(1);
      await expect(side.getByTestId('side-lesson')).toHaveAttribute('data-topic', 'C4');
      await page.getByTestId('lesson-search').fill('zzzzzz');
      await expect(side.getByTestId('side-empty')).toBeVisible();
      // Typing in the search drives no player key.
      await page.getByTestId('lesson-search').fill('');
      await page.getByTestId('lesson-search').press('ArrowRight');
      expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(1);
      await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
    });

    test('the glossary tab shows a word of the text in the column, not in place', async ({
      page,
    }) => {
      await openApp(page, '/ru/lesson/B1');
      await page.getByTestId('side-tab-glossary').click();
      await expect(page.getByTestId('lessons-panel').getByTestId('glossary-list')).toBeVisible();
      await run(page, 'glossary.open', { id: 'sql-injection' });
      await expect(page.getByTestId('lessons-panel').getByTestId('glossary-entry')).toBeVisible();
      await expect(page.getByTestId('glossary-popover')).toHaveCount(0);
      await page.getByTestId('side-tab-lessons').click();
      await expect(page.getByTestId('lessons-panel').getByTestId('side-list')).toBeVisible();
    });
  });
});

test.describe('at 1024 the lessons are behind «☰ Уроки»', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('a button in the top bar opens the side panel', async ({ page }) => {
    await openApp(page, '/ru/lesson/B1');
    await expect(page.getByTestId('lessons-panel')).toHaveCount(0);
    await expect(page.getByTestId('lesson-search')).toHaveCount(0);
    const button = page.getByTestId('open-lessons');
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByTestId('drawer')).toBeVisible();
    await expect(page.getByTestId('drawer-tab-lessons')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(button).toBeFocused();
  });
});

// One screen (design §2) on every lesson in both languages: the page does not scroll, the panels
// stand where the design puts them; a phone has one column. CI7: one test per lesson and
// language, each with its own timeout, run in parallel; the page is loaded once and resized
// through the five sizes (the layout is CSS and follows the window) instead of ten loads.
const DESKTOPS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;
const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

async function threeColumns(page: Page, viewport: (typeof DESKTOPS)[number], where: string) {
  const m = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));
  expect(m.height, where).toBeLessThanOrEqual(viewport.height);
  expect(m.width, where).toBeLessThanOrEqual(viewport.width);
  const [top, scene, explain, log] = await Promise.all([
    box(page, 'topbar'),
    box(page, 'scene-panel'),
    box(page, 'explain'),
    box(page, 'log'),
  ]);
  expect(scene.y, where).toBeGreaterThanOrEqual(top.y + top.height);
  expect(explain.x, where).toBeGreaterThanOrEqual(scene.x + scene.width);
  expect(log.y, where).toBeGreaterThanOrEqual(scene.y + scene.height);
  // «Ход атаки» runs under the scene and the explanation.
  expect(Math.abs(log.x - scene.x), where).toBeLessThan(2);
  expect(Math.abs(log.x + log.width - (explain.x + explain.width)), where).toBeLessThan(2);
  expect(log.y + log.height, where).toBeLessThanOrEqual(viewport.height);
  // The player stands in the head of «Ход атаки».
  const player = await box(page, 'player');
  expect(player.y, where).toBeGreaterThanOrEqual(log.y);
  expect(player.y + player.height, where).toBeLessThanOrEqual(log.y + 80);
  // The defence switch stands in the head of the scene panel.
  const toggle = await box(page, 'defence-toggle');
  expect(toggle.y, where).toBeGreaterThanOrEqual(scene.y);
  expect(toggle.y + toggle.height, where).toBeLessThanOrEqual(scene.y + 80);
}

async function oneColumn(page: Page, phone: (typeof PHONES)[number], where: string) {
  const [top, scene, player, explain, log] = await Promise.all([
    box(page, 'topbar'),
    box(page, 'scene-panel'),
    box(page, 'player'),
    box(page, 'explain'),
    box(page, 'log'),
  ]);
  expect(scene.y, where).toBeGreaterThanOrEqual(top.y + top.height);
  expect(player.y, where).toBeGreaterThanOrEqual(scene.y + scene.height);
  expect(explain.y, where).toBeGreaterThanOrEqual(player.y + player.height);
  expect(log.y, where).toBeGreaterThanOrEqual(explain.y + explain.height);
  for (const b of [scene, explain, log]) {
    expect(b.width, where).toBeGreaterThan(phone.width * 0.85);
  }
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(sideways, where).toBeLessThanOrEqual(0);
}

test.describe('every lesson: one screen in three columns on a laptop, one column on a phone', () => {
  for (const lesson of LESSONS) {
    for (const lang of LANGS) {
      test(`${lang} ${lesson}: three columns at 1024, 1280 and 1440; one column at 390 and 360`, async ({
        page,
      }) => {
        await page.setViewportSize(DESKTOPS[0]);
        await openApp(page, `/${lang}/lesson/${lesson}`);
        await run(page, 'player.goto', { step: 3 });
        await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS);
        for (const viewport of DESKTOPS) {
          await page.setViewportSize(viewport);
          const where = `${lang} ${lesson} at ${String(viewport.width)}`;
          await expect(page.getByTestId('lessons-panel'), where).toHaveCount(
            viewport.width >= 1280 ? 1 : 0,
          );
          await threeColumns(page, viewport, where);
        }
        // On a phone the lesson is checked as it opens, on its first step.
        await run(page, 'player.goto', { step: 1 });
        for (const phone of PHONES) {
          await page.setViewportSize(phone);
          const where = `${lang} ${lesson} at ${String(phone.width)}`;
          await expect(page.getByTestId('lessons-panel'), where).toHaveCount(0);
          await expect(page.getByTestId('open-lessons'), where).toBeVisible();
          await oneColumn(page, phone, where);
        }
      });
    }
  }
});

// Screenshots for a look against the mock-up (M61_SHOTS): B1, K1 and «О проекте».
for (const size of [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 720 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
] as const) {
  test.describe(`screenshots at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const lang of LANGS) {
      test(`${lang}: B1, K1 and the about page`, async ({ page }, testInfo) => {
        const phone = size.width < 768;
        for (const lesson of ['B1', 'K1']) {
          await openApp(page, `/${lang}/lesson/${lesson}`);
          await page.evaluate(() => window.__app?.clock.set(0));
          await run(page, 'player.goto', { step: 3 });
          await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS / 2);
          if (size.width >= 1280) {
            await expect(page.getByTestId('side-steps')).toBeVisible();
          }
          await sceneReady(page);
          await keep(page, testInfo, `m61-${lesson}-${lang}-${size.name}`, phone);
        }
        await openApp(page, `/${lang}/lesson/B1`);
        await page.getByTestId('nav-about').click();
        await expect(page.getByTestId('about-lesson').first()).toBeVisible();
        await keep(page, testInfo, `m61-about-${lang}-${size.name}`, phone);
      });
    }
  });
}
