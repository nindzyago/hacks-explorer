// M2.6 acceptance (oracle D for the check, C R9 for the screenshots; scenario S10): on a phone
// 360, 375 and 390 px wide, and on a phone held sideways, in Russian and English, no screen and
// no state scrolls sideways and nothing sticks out past the right or left edge: every lesson
// (G18; B1 and I1 before) at the first, middle and last step, in both modes, at every depth, while playing; a glossary
// definition (CI7, K136: every lesson at 360 px and sideways; 375 and 390 by S10); the lessons panel (both tabs, a found list, a section, a long query with no result,
// a glossary entry); the «no such page» and the load-error pages. A self-test shows the check
// catches a deliberately broken layout. Screenshots go to PHONE_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { stepsInMode } from '../src/core/scene-layout/message';
import { LANGS, LESSONS, lessonData } from './lessons';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const TRAVEL_MS = 900;
/** 100 characters without a space: the longest query the search field takes (K114). */
const LONG_QUERY =
  'кракозябрапереполнениебуфераинъекциязапросовфишинговаярассылкаподделкамежсайтовогозапросатокенаааа';

const PHONES = [
  { name: '360', width: 360, height: 800 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
] as const;
/** The phones every lesson is checked at here (CI7). */
const LESSON_PHONES: ReadonlySet<string> = new Set(['360', 'landscape']);

/** Keeps a screenshot (the whole page, or the window for a panel) when PHONE_SHOTS names a folder. */
async function keep(page: Page, testInfo: TestInfo, name: string, full = true): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage: full });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['PHONE_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [id, params] as const);
}

/**
 * What sticks out sideways: the page's and the body's scroll width beyond the window, and every
 * drawn element whose box, cut by the boxes of its clipping ancestors (overflow other than
 * `visible`), reaches past the right edge or before the left one by more than half a pixel.
 * Content inside an inner scroll area (a code block) counts only where that area itself ends.
 */
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const out: string[] = [];
    const root = document.documentElement.scrollWidth;
    const body = document.body.scrollWidth;
    if (root > width) out.push(`document scrollWidth ${String(root)} > ${String(width)}`);
    if (body > width) out.push(`body scrollWidth ${String(body)} > ${String(width)}`);
    const name = (el: Element): string => {
      const id = el.getAttribute('data-testid');
      const cls = el.getAttribute('class');
      return `<${el.tagName.toLowerCase()}${id === null ? '' : ` data-testid="${id}"`}${
        cls === null ? '' : ` class="${cls.slice(0, 40)}"`
      }>`;
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg') continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'contents') continue;
      const box = el.getBoundingClientRect();
      // Nothing drawn, or a screen-reader-only box (1 × 1 px, clipped).
      if (box.width <= 1 || box.height <= 1) continue;
      let left = box.left;
      let right = box.right;
      for (let up = el.parentElement; up !== null && up !== document.body; up = up.parentElement) {
        const s = getComputedStyle(up);
        if (s.overflowX !== 'visible' || s.clipPath !== 'none') {
          const clip = up.getBoundingClientRect();
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
      }
      if (right <= left) continue;
      // An inner area that scrolls sideways (only a code block may: CodeBox).
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        el.scrollWidth > el.clientWidth &&
        el.closest('pre') === null
      ) {
        out.push(
          `${name(el)} scrolls sideways: ${String(el.scrollWidth)} > ${String(el.clientWidth)}`,
        );
      }
      if (right > width + 0.5 || left < -0.5) {
        out.push(
          `${name(el)} from ${left.toFixed(1)} to ${right.toFixed(1)} (window ${String(width)})`,
        );
      }
    }
    return out;
  });
}

async function noSideways(page: Page, where: string): Promise<void> {
  expect(await sideways(page), where).toEqual([]);
}

/** Shows step `step` of the open lesson in a mode, at rest. */
async function show(page: Page, defence: boolean, step: number): Promise<void> {
  await page.evaluate(
    ([on, n, t]) => {
      window.__app?.clock.set(0);
      window.__app?.commands.run('defence.set', { on });
      window.__app?.commands.run('player.goto', { step: n });
      window.__app?.clock.set(t);
    },
    [defence, step, TRAVEL_MS] as const,
  );
}

for (const phone of PHONES) {
  test.describe(`M2.6 at ${String(phone.width)}×${String(phone.height)}`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    for (const lang of LANGS) {
      const at = `${lang} ${phone.name}`;
      const shot = (what: string) => `${what}-${lang}-${phone.name}`;

      // G18: each lesson its own test, its first, middle and last step from its data. CI7: at
      // the narrowest phone (360) and sideways; at 375 and 390 every step and depth of every
      // lesson is checked for sideways scroll, small and cut text by phone.spec.ts (S10).
      for (const lesson of LESSON_PHONES.has(phone.name) ? LESSONS : []) {
        test(`${lang} ${lesson}: every mode and depth, first, middle and last step, playing`, async ({
          page,
        }, testInfo) => {
          await openApp(page, `/${lang}/lesson/${lesson}`);
          await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', lesson);
          await sceneReady(page);
          await noSideways(page, `${at} ${lesson} first paint`);
          const data = await lessonData(page, lesson, lang);
          for (const defence of [false, true]) {
            const mode = defence ? 'defence' : 'attack';
            const count = stepsInMode(data.steps, defence).length;
            expect(count).toBeGreaterThan(0);
            for (const step of [...new Set([1, Math.ceil(count / 2), count])]) {
              await show(page, defence, step);
              await expect(page.getByTestId('message')).toHaveAttribute('data-arrived', 'true');
              for (const depth of ['simple', 'steps', 'deep'] as const) {
                await run(page, 'depth.set', { depth });
                await noSideways(page, `${at} ${lesson} ${mode} step ${String(step)} ${depth}`);
                if (
                  (lesson === 'B1' || lesson === 'I1') &&
                  phone.name === '360' &&
                  step === 3 &&
                  depth !== 'steps'
                ) {
                  await keep(page, testInfo, shot(`${lesson}-${mode}-step3-${depth}`));
                }
              }
              await run(page, 'depth.set', { depth: 'simple' });
            }
          }
          // Playing: the message is on its way and the play button says «Пауза».
          await show(page, false, 1);
          await run(page, 'player.play');
          await page.evaluate((t) => window.__app?.clock.set(t), TRAVEL_MS / 2);
          await noSideways(page, `${at} ${lesson} playing`);
          await run(page, 'player.pause');
        });
      }

      test(`${lang}: a glossary definition over the lesson`, async ({ page }, testInfo) => {
        await openApp(page, `/${lang}/lesson/I1`);
        await sceneReady(page);
        await run(page, 'glossary.open', { id: 'phishing' });
        await expect(page.getByTestId('glossary-popover')).toBeVisible();
        await expect(page.getByTestId('glossary-definition')).toBeVisible();
        await noSideways(page, `${at} glossary popover`);
        if (phone.name === '360') await keep(page, testInfo, shot('glossary-popover'), false);
        await run(page, 'glossary.close');
      });

      test(`${lang}: the lessons panel, both tabs, search, sections, an empty result`, async ({
        page,
      }, testInfo) => {
        await openApp(page, `/${lang}/lesson/B1`);
        await page.getByTestId('open-lessons').click();
        await expect(page.getByTestId('drawer')).toBeVisible();
        await expect(page.getByTestId('catalog')).toHaveAttribute('data-state', 'ready');
        await noSideways(page, `${at} lessons`);
        if (phone.name === '360') await keep(page, testInfo, shot('drawer-lessons'), false);
        const search = page.getByTestId('catalog-search');
        await search.fill('sql');
        await expect(page.getByTestId('catalog-topic')).toHaveCount(2);
        await noSideways(page, `${at} lessons «sql»`);
        await search.fill(LONG_QUERY);
        await expect(page.getByTestId('catalog-empty')).toBeVisible();
        await noSideways(page, `${at} lessons long query, nothing found`);
        if (phone.name === '360') await keep(page, testInfo, shot('drawer-empty'), false);
        await page.getByTestId('catalog-reset').click();
        // Every section: the longest section names come with the narrowest list.
        const sections = await page
          .getByTestId('catalog-section')
          .locator('option')
          .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
        for (const section of sections) {
          await page.getByTestId('catalog-section').selectOption(section);
          await noSideways(page, `${at} lessons section «${section}»`);
        }
        await page.getByTestId('drawer-tab-glossary').click();
        await expect(page.getByTestId('glossary-list')).toHaveAttribute('data-state', 'ready');
        await noSideways(page, `${at} glossary tab`);
        if (phone.name === '360') await keep(page, testInfo, shot('drawer-glossary'), false);
        await page.getByTestId('glossary-search').fill(LONG_QUERY);
        await expect(page.getByTestId('glossary-empty')).toBeVisible();
        await noSideways(page, `${at} glossary long query, nothing found`);
        await page.getByTestId('glossary-reset').click();
        await page.getByTestId('glossary-term').first().click();
        await expect(page.getByTestId('glossary-entry')).toBeVisible();
        await noSideways(page, `${at} glossary entry`);
        if (phone.name === '360') await keep(page, testInfo, shot('drawer-glossary-entry'), false);
        // A term opened while the panel is open is shown in it (K113).
        await run(page, 'glossary.open', { id: 'sql-injection' });
        await expect(page.getByTestId('glossary-entry')).toHaveAttribute(
          'data-term',
          'sql-injection',
        );
        await noSideways(page, `${at} glossary entry by command`);
      });

      test(`${lang}: the home page, «no such page», a missing lesson, the load error`, async ({
        page,
      }, testInfo) => {
        await openApp(page, `/${lang}/`);
        await sceneReady(page);
        await noSideways(page, `${at} home`);
        await page.goto(`/${lang}/lesson/Z9`);
        await expect(page.getByTestId('lesson-error')).toBeVisible();
        await noSideways(page, `${at} missing lesson`);
        await page.goto(`/${lang}/no/such/page`);
        await expect(page.getByTestId('page-not-found')).toBeVisible();
        await noSideways(page, `${at} not found`);
        if (phone.name === '360') await keep(page, testInfo, shot('not-found'));
        await page.route('**/data/catalog.json', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: '{' }),
        );
        await page.goto(`/${lang}/lesson/B1`);
        await expect(page.getByTestId('lesson-error')).toBeVisible();
        await noSideways(page, `${at} load error`);
        if (phone.name === '360') await keep(page, testInfo, shot('load-error'));
      });
    }
  });
}

test.describe('M2.6 self-test: the check catches a broken layout', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('a too wide top bar, a word that sticks out, a panel that scrolls sideways', async ({
    page,
  }) => {
    await openApp(page, '/ru/lesson/B1');
    expect(await sideways(page)).toEqual([]);
    // A top bar wider than the phone: the page scrolls sideways.
    // (The page's CSP forbids style tags: the styles are set through the CSSOM.)
    const style = (testid: string, css: Partial<CSSStyleDeclaration>) =>
      page.evaluate(
        ([id, c]) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          if (el !== null) Object.assign(el.style, c);
        },
        [testid, css] as const,
      );
    await style('topbar', { minWidth: '420px' });
    const wide = await sideways(page);
    expect(wide.some((line) => line.startsWith('document scrollWidth'))).toBe(true);
    expect(wide.some((line) => line.includes('data-testid="topbar"'))).toBe(true);
    // A long word in the title that sticks out without widening the page (the page clips it).
    await style('topbar', { minWidth: '0' });
    await page.evaluate(() => {
      document.documentElement.style.overflowX = 'clip';
      document.body.style.overflowX = 'clip';
    });
    await style('lesson-title', { whiteSpace: 'nowrap', width: 'max-content' });
    await page.evaluate(() => {
      const title = document.querySelector('[data-testid="lesson-title"]');
      if (title !== null) title.textContent = 'Оченьдлинноесловобезпробелов'.repeat(4);
    });
    const cut = await sideways(page);
    expect(cut.some((line) => line.includes('data-testid="lesson-title"'))).toBe(true);
    // A list wider than the lessons panel: the panel scrolls sideways inside a page that does not.
    await openApp(page, '/ru/lesson/B1');
    await page.evaluate(() => window.__app?.commands.run('drawer.open', { tab: 'lessons' }));
    await expect(page.getByTestId('catalog')).toHaveAttribute('data-state', 'ready');
    expect(await sideways(page)).toEqual([]);
    await style('catalog-list', { minWidth: '600px' });
    const inner = await sideways(page);
    expect(inner.some((line) => line.includes('scrolls sideways'))).toBe(true);
    expect(inner.some((line) => line.startsWith('document scrollWidth'))).toBe(false);
  });
});
