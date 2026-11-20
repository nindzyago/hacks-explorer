// M6.1 acceptance (design M6 §2–4, K129): the blueprint screen of variant A «Три колонки».
// From 1280 px the lessons column is on the left without a click; at 1024 it is the side panel
// behind «☰ Уроки». The section chips of the top bar filter the list; a step of the open lesson
// in the list goes to that step. The page is one screen at 1024, 1280 and 1440 on every lesson in
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

    test('the section chips filter the list; pressing again shows all', async ({ page }) => {
      await openApp(page, '/ru/lesson/B1');
      const side = page.getByTestId('lessons-panel');
      await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
      // The section of the open lesson is marked, none is chosen.
      await expect(page.getByTestId('section-B')).toHaveClass(/here/);
      await expect(page.getByTestId('section-B')).toHaveAttribute('aria-pressed', 'false');
      const inC = LESSONS.filter((id) => id.startsWith('C'));
      await page.getByTestId('section-C').click();
      await expect(page.getByTestId('section-C')).toHaveAttribute('aria-pressed', 'true');
      await expect(side.getByTestId('side-lesson')).toHaveCount(inC.length);
      for (const topic of await side.getByTestId('side-lesson').all()) {
        expect(await topic.getAttribute('data-topic')).toMatch(/^C/);
      }
      // «Все» adds the topics of the section still being written, after the ready ones.
      await side.getByTestId('side-all').click();
      await expect(side.getByTestId('side-soon').first()).toBeVisible();
      for (const topic of await side.getByTestId('side-soon').all()) {
        expect(await topic.getAttribute('data-topic')).toMatch(/^C/);
      }
      await side.getByTestId('side-ready').click();
      await expect(side.getByTestId('side-soon')).toHaveCount(0);
      await page.getByTestId('section-C').click();
      await expect(page.getByTestId('section-C')).toHaveAttribute('aria-pressed', 'false');
      await expect(side.getByTestId('side-lesson')).toHaveCount(LESSONS.length);
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
// stand where the design puts them.
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const) {
  test.describe(`the screen at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport });

    for (const lang of LANGS) {
      test(`${lang}: every lesson is one screen in three columns`, async ({ page }) => {
        for (const lesson of LESSONS) {
          await openApp(page, `/${lang}/lesson/${lesson}`);
          await run(page, 'player.goto', { step: 3 });
          await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS);
          const where = `${lang} ${lesson}`;
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
          await expect(page.getByTestId('lessons-panel')).toHaveCount(
            viewport.width >= 1280 ? 1 : 0,
          );
        }
      });
    }
  });
}

for (const phone of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test.describe(`a phone at ${String(phone.width)}×${String(phone.height)}`, () => {
    test.use({ viewport: phone });

    for (const lang of LANGS) {
      test(`${lang}: every lesson is one column — scene, player, explanation, log`, async ({
        page,
      }) => {
        for (const lesson of LESSONS) {
          await openApp(page, `/${lang}/lesson/${lesson}`);
          const where = `${lang} ${lesson}`;
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
          await expect(page.getByTestId('lessons-panel')).toHaveCount(0);
          await expect(page.getByTestId('open-lessons')).toBeVisible();
        }
      });
    }
  });
}

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
