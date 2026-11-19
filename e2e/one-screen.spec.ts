// M2.1a acceptance (design M2.1 E1, E5, D2; K91, K93): on a laptop from 1024×768 the lesson is
// one screen — the page never scrolls, only the explanation panel and the steps area scroll
// inside; the «Ход атаки» table carries the marks of the old event feed; «Фишинг» (I1) opens on
// the home page. M2.3b: both languages, every depth. Screenshots go to ONE_SCREEN_SHOTS when it
// names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { stepsInMode } from '../src/core/scene-layout/message';
import { LANGS, LESSONS, lessonData } from './lessons';
import { expect, openApp, sceneReady, test } from './support';

const TRAVEL_MS = 900;
// G18: every lesson in content/lessons, in both languages.
const PAIRS = LANGS.flatMap((lang) => LESSONS.map((lesson) => [lang, lesson] as const));
const SHOT = { animations: 'disabled', caret: 'hide' } as const;

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function tick(page: Page, ms: number): Promise<void> {
  expect(await page.evaluate((t) => window.__app?.clock.tick(t), ms)).toEqual({ ok: true });
}

async function keep(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  await sceneReady(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['ONE_SCREEN_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

/** Where the page, the steps area and the explanation panel stand right now. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const area = document.querySelector<HTMLElement>('[data-testid="steps-area"]');
    const row = document.querySelector<HTMLElement>('[data-testid="steps-table"] tr.now');
    const explain = document.querySelector<HTMLElement>('[data-testid="explain"]');
    if (area === null || row === null || explain === null) throw new Error('not drawn');
    const a = area.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const head = area.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const e = explain.getBoundingClientRect();
    return {
      height: root.scrollHeight,
      inner: window.innerHeight,
      sideways: root.scrollWidth - window.innerWidth,
      scrollY: window.scrollY,
      area: { top: a.top, bottom: a.bottom, height: a.height },
      areaOverflow: getComputedStyle(area).overflowY,
      // The current row is under the sticky header and above the bottom of the area.
      rowInside: r.top >= a.top + head - 1 && r.bottom <= a.bottom + 1,
      explain: {
        bottom: e.bottom,
        overflow: getComputedStyle(explain).overflowY,
        scrolls: explain.scrollHeight > explain.clientHeight,
      },
    };
  });
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
] as const) {
  const size = `${String(viewport.width)}×${String(viewport.height)}`;
  test.describe(`one screen at ${size}`, () => {
    test.use({ viewport });

    for (const [lang, lesson] of PAIRS) {
      // M2.3b: English too, at every depth.
      test(`${lang} ${lesson}: every step of both modes fits, the current row is in view`, async ({
        page,
      }, testInfo) => {
        await openApp(page, `/${lang}/lesson/${lesson}`);
        await page.evaluate(() => window.__app?.clock.set(0));
        await expect(page.getByTestId('step-row-1')).toBeVisible();
        const data = await lessonData(page, lesson, lang);
        for (const on of [false, true]) {
          await run(page, 'defence.set', { on });
          await run(page, 'player.goto', { step: 1 });
          // G18: as many rows as the mode has steps in the lesson's data.
          const steps = await page.getByTestId('steps-table').locator('tbody tr').count();
          expect(steps).toBe(stepsInMode(data.steps, on).length);
          expect(steps).toBeGreaterThan(0);
          for (let n = 1; n <= steps; n += 1) {
            await run(page, 'player.goto', { step: n });
            await tick(page, TRAVEL_MS);
            await expect(page.getByTestId(`step-row-${String(n)}`)).toHaveAttribute(
              'aria-current',
              'step',
            );
            for (const depth of ['simple', 'steps', 'deep'] as const) {
              await run(page, 'depth.set', { depth });
              const m = await measure(page);
              const where = `${lang} ${lesson} step ${String(n)} defence ${String(on)} ${depth}`;
              expect(m.height, `page height, ${where}`).toBeLessThanOrEqual(m.inner);
              expect(m.sideways, `sideways, ${where}`).toBeLessThanOrEqual(0);
              expect(m.scrollY, `page scroll, ${where}`).toBe(0);
              expect(m.area.bottom, `steps area bottom, ${where}`).toBeLessThanOrEqual(m.inner);
              expect(m.area.height, `steps area height, ${where}`).toBeGreaterThanOrEqual(120);
              expect(m.areaOverflow, where).toBe('auto');
              expect(m.rowInside, `current row inside the area, ${where}`).toBe(true);
              expect(m.explain.bottom, `explain bottom, ${where}`).toBeLessThanOrEqual(m.inner);
              expect(m.explain.overflow, where).toBe('auto');
              testInfo.annotations.push({
                type: 'height',
                description: `${where}: ${String(m.height)}/${String(m.inner)}`,
              });
            }
            await run(page, 'depth.set', { depth: 'simple' });
          }
          // Back to the first step: the area scrolls back to it, the page stays.
          await run(page, 'player.goto', { step: 1 });
          const m = await measure(page);
          expect(m.rowInside).toBe(true);
          expect(m.scrollY).toBe(0);
        }
        // The explanation scrolls inside: the passport and the sources are below its fold.
        expect((await measure(page)).explain.scrolls).toBe(true);
        for (const on of [false, true]) {
          await run(page, 'defence.set', { on });
          await run(page, 'player.goto', { step: 3 });
          await tick(page, TRAVEL_MS);
          const mode = on ? 'defence' : 'attack';
          if (lesson !== 'B1' && lesson !== 'I1') continue;
          const name = lang === 'ru' ? `m21a-${lesson}` : `m23b-en-${lesson}`;
          await keep(page, testInfo, `${name}-${mode}-step3-${String(viewport.width)}`);
        }
      });
    }

    test('arrow keys move the step, not the page', async ({ page }) => {
      await openApp(page, '/ru/lesson/B1');
      await page.locator('body').click({ position: { x: 2, y: 2 } });
      for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('step-row-5')).toHaveAttribute('aria-current', 'step');
      const m = await measure(page);
      expect(m.scrollY).toBe(0);
      expect(m.rowInside).toBe(true);
    });
  });
}

// D2 (K91): the table and the feed are one area. The rows up to the current one have happened
// and carry the mark (sign and word); the current one is «в пути» until its message arrives.
test.describe('the steps area carries the feed', () => {
  test('marks happened rows, the current one on its way, no separate feed', async ({ page }) => {
    await openApp(page, '/ru/lesson/B1');
    await page.evaluate(() => window.__app?.clock.set(0));
    await run(page, 'player.goto', { step: 1 });
    await expect(page.getByTestId('feed')).toHaveCount(0);
    await expect(page.getByTestId('step-row-1')).toHaveAttribute('data-mark', 'moving');
    await expect(page.getByTestId('step-row-1').getByTestId('step-mark')).toContainText('в пути');
    await expect(page.getByTestId('step-row-2')).toHaveAttribute('data-mark', 'future');
    await tick(page, TRAVEL_MS);
    await expect(page.getByTestId('step-row-1')).toHaveAttribute('data-mark', 'legit');
    await expect(page.getByTestId('step-row-1').getByTestId('step-mark')).toContainText('обычное');
  });
});

// E5 (K7): the home page opens «Фишинг».
test('the home page opens «Фишинг» (I1)', async ({ page }) => {
  await openApp(page, '/');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
  await expect(page.getByTestId('lesson-title')).toHaveText('Фишинг');
  expect(await page.evaluate(() => window.__app?.state.get().lesson)).toBe('I1');
});

// Phone (S10): one column, the page scrolls as before; the steps area does not scroll inside.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [lang, lesson] of PAIRS) {
    test(`${lang} ${lesson}: one column, the page scrolls, no inner scroll of the steps`, async ({
      page,
    }, testInfo) => {
      await openApp(page, `/${lang}/lesson/${lesson}`);
      await page.evaluate(() => window.__app?.clock.set(0));
      for (const on of [false, true]) {
        await run(page, 'defence.set', { on });
        await run(page, 'player.goto', { step: 3 });
        await tick(page, TRAVEL_MS);
        const m = await page.evaluate(() => {
          const area = document.querySelector<HTMLElement>('[data-testid="steps-area"]');
          if (area === null) throw new Error('no steps area');
          return {
            height: document.documentElement.scrollHeight,
            inner: window.innerHeight,
            sideways: document.documentElement.scrollWidth - window.innerWidth,
            areaScrolls: area.scrollHeight > area.clientHeight + 1,
          };
        });
        expect(m.height).toBeGreaterThan(m.inner);
        expect(m.sideways).toBeLessThanOrEqual(0);
        expect(m.areaScrolls).toBe(false);
        const mode = on ? 'defence' : 'attack';
        if (lesson !== 'B1' && lesson !== 'I1') continue;
        const name = lang === 'ru' ? `m21a-${lesson}` : `m23b-en-${lesson}`;
        await keep(page, testInfo, `${name}-${mode}-step3-390`, true);
      }
    });
  }
});
