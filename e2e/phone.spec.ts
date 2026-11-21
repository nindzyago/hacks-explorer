// M1.2c, scenario S10 «Телефон» (oracle D) and the step-3 screenshots for the verifier's R-UI
// look (oracle C): at 390 × 844 (M1.2d: also 375 and 360) the page has no sideways scroll, no
// text below 11 px and no text cut with «…» on every step of B1 and I1 in both modes; the
// controls of the error state are at least 44 px. M2.3b: in Russian and English, at every depth.
// G18: every lesson in content/lessons, its step counts from its data.
// The player's own buttons come with M1.3 and get the same check there. Screenshots go to
// SCENE_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { stepsInMode } from '../src/core/scene-layout/message';
import { authored, LANGS, LESSONS, lessonData } from './lessons';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const TRAVEL_MS = 900;

/** Keeps a screenshot for a human look when SCENE_SHOTS names a folder. */
async function keep(page: Page, testInfo: TestInfo, name: string, full = false): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage: full });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['SCENE_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

/** Shows step `step` of the open lesson in a mode, `ms` of player time after it starts. */
async function show(page: Page, defence: boolean, step: number, ms: number): Promise<void> {
  await page.evaluate(
    ([on, n, t]) => {
      window.__app?.clock.set(0);
      window.__app?.commands.run('defence.set', { on });
      window.__app?.commands.run('player.goto', { step: n });
      window.__app?.clock.set(t);
    },
    [defence, step, ms] as const,
  );
}

/** Every piece of text on the page that is drawn, with its font size: HTML and SVG alike. */
async function textSizes(page: Page): Promise<{ text: string; size: number }[]> {
  return page.evaluate(() => {
    const out: { text: string; size: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const parent = node.parentElement;
      if (text === '' || parent === null) continue;
      // <title>, <desc> and other text that is not drawn has no box.
      const box = parent.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (parent.closest('title, desc, script, style') !== null) continue;
      out.push({ text, size: Number.parseFloat(getComputedStyle(parent).fontSize) });
    }
    return out;
  });
}

// M1.2d: the narrow Android phones too (360 px is very common), with every label and address
// whole: no «…» anywhere on the scene, the message's label included.
// CI7: every step of every lesson at the two ends, 390 and 360; 375 lies between them and
// gets the checks of the scene as it opens (scene.spec.ts) and the step-3 screenshots below.
for (const phone of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test.describe(`S10 at ${String(phone.width)}×${String(phone.height)}`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    for (const lang of LANGS) {
      for (const lesson of LESSONS) {
        // M2.3b: in English too, and at every depth (the explanation's length changes the page).
        test(`${lang} ${lesson}: no sideways scroll, no text below 11 px, nothing cut on any step`, async ({
          page,
        }, testInfo) => {
          await openApp(page, `/${lang}/lesson/${lesson}`);
          await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', lesson);
          await sceneReady(page);
          const data = await lessonData(page, lesson, lang);
          let checked = 0;
          let expected = 0;
          for (const defence of [false, true]) {
            const mode = defence ? 'defence' : 'attack';
            const count = stepsInMode(data.steps, defence).length;
            expected += count;
            for (let step = 1; step <= count; step += 1) {
              await show(page, defence, step, TRAVEL_MS);
              await expect(page.getByTestId('scene-step')).toContainText(
                lang === 'ru'
                  ? `Шаг ${String(step)} из ${String(count)}.`
                  : `Step ${String(step)} of ${String(count)}.`,
              );
              await expect(page.getByTestId('message')).toHaveAttribute('data-arrived', 'true');
              for (const depth of ['simple', 'steps', 'deep'] as const) {
                await page.evaluate(
                  (d) => window.__app?.commands.run('depth.set', { depth: d }),
                  depth,
                );
                const where = `${lang} ${lesson} ${mode} step ${String(step)} ${depth} at ${String(phone.width)}`;
                const scroll = await page.evaluate(() => ({
                  page: document.documentElement.scrollWidth,
                  body: document.body.scrollWidth,
                  window: window.innerWidth,
                }));
                expect(scroll.page, where).toBeLessThanOrEqual(scroll.window);
                expect(scroll.body, where).toBeLessThanOrEqual(scroll.window);
                const texts = await textSizes(page);
                expect(
                  texts.filter((t) => t.size < 11),
                  where,
                ).toEqual([]);
                // Cut by the site, not an «…» the lesson itself writes (G18: D1, F1, J1 code).
                expect(
                  texts.filter((t) => t.text.includes('…') && !authored(data, t.text)),
                  where,
                ).toEqual([]);
                // Short inline code stays on one line: no «admin' -» / «- reaches» (M2.3b).
                const broken = await page.evaluate(() =>
                  Array.from(document.querySelectorAll('[data-testid="explain"] code'))
                    .filter((c) => c.closest('pre') === null)
                    .filter((c) => c.textContent.length <= 24)
                    .filter((c) => c.getClientRects().length > 1)
                    .map((c) => c.textContent),
                );
                expect(broken, where).toEqual([]);
              }
              await page.evaluate(() =>
                window.__app?.commands.run('depth.set', { depth: 'simple' }),
              );
              if (lesson === 'B1' || lesson === 'I1') {
                const prefix = lang === 'ru' ? 'strip' : 'strip-en';
                await keep(
                  page,
                  testInfo,
                  `${prefix}-${lesson}-${mode}-step${String(step)}-${String(phone.width)}`,
                );
              }
              checked += 1;
            }
          }
          expect(checked).toBe(expected);
          expect(checked).toBeGreaterThan(0);
        });
      }
    }
  });
}

test.describe('S10 at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the controls of the error state are at least 44 × 44 px', async ({ page }) => {
    await page.route('**/data/catalog.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{' }),
    );
    await page.goto('/ru/lesson/B1');
    await expect(page.getByTestId('lesson-error')).toBeVisible();
    for (const id of ['lesson-error-retry', 'lesson-error-home']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const small = (await textSizes(page)).filter((t) => t.size < 11);
    expect(small).toEqual([]);
  });
});

// Step 3 of B1 and I1 in both modes, at the middle of the path and at rest, on a laptop and a
// phone: the pictures the verifier scores by R-UI.
for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-360', width: 360, height: 800 },
] as const) {
  test.describe(`step 3 screenshots at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('B1 and I1, both modes', async ({ page }, testInfo) => {
      await openApp(page);
      for (const lesson of ['B1', 'I1']) {
        await page.evaluate((id) => window.__app?.commands.run('lesson.open', { id }), lesson);
        await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', lesson);
        await sceneReady(page);
        for (const defence of [false, true]) {
          const mode = defence ? 'defence' : 'attack';
          for (const [moment, ms] of [
            ['middle', TRAVEL_MS / 2],
            ['end', TRAVEL_MS],
          ] as const) {
            await show(page, defence, 3, ms);
            await expect(page.getByTestId('scene-step')).toContainText('Шаг 3 из 5.');
            await sceneReady(page);
            await keep(page, testInfo, `step3-${lesson}-${mode}-${moment}-${viewport.name}`, true);
          }
        }
      }
    });
  });
}
