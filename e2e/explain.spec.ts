// M1.4 acceptance (oracle D): scenario S3 «Три уровня глубины» through the control channel, the
// tabs by mouse and keyboard, the passport (class, severity, sources) of B1 and I1, and the panel
// on a phone. Expected texts come from the built lesson data, not from copies in the test.
// Screenshots go to EXPLAIN_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { SiteBlock, SiteInline, SiteLesson } from '../src/core/lesson/site';
import { currentStep, stepsInMode } from '../src/core/scene-layout/message';
import type { FetchLike } from '../src/services/catalog/catalog';
import { createLessonLoader } from '../src/services/catalog/catalog';
import { expect, openApp, sceneReady, test } from './support';

const DEPTHS = ['simple', 'steps', 'deep'] as const;
type Depth = (typeof DEPTHS)[number];
const LEVEL = { simple: 'simple', steps: 'detailed', deep: 'deep' } as const;

/** `fetch` run inside the page, so the browser's CSP and the static server both apply. */
function pageFetch(page: Page): FetchLike {
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

async function lessonData(page: Page, id: string): Promise<SiteLesson> {
  const result = await createLessonLoader({ fetch: pageFetch(page) }).lesson(id, 'ru');
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** All text of a tree, without spaces: what the reader sees, whatever the line breaks. */
function inlineText(nodes: readonly SiteInline[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text' || n.type === 'code') return n.value;
      if (n.type === 'break') return '';
      return inlineText(n.children);
    })
    .join('');
}
function blocksText(blocks: readonly SiteBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'paragraph') return inlineText(b.children);
      if (b.type === 'list') return b.items.map(blocksText).join('');
      return b.segments.map((s) => s.text).join('');
    })
    .join('')
    .replace(/\s+/g, '');
}

async function run(page: Page, id: string, params?: unknown) {
  return page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [id, params] as const);
}

async function playerOf(page: Page) {
  return page.evaluate(() => window.__app?.state.get().player);
}

/** The level text drawn in the panel (the step line and the code boxes left out), no spaces. */
async function shownLevel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const blocks = document.querySelector('[data-testid="explain-text"] > .blocks');
    return (blocks?.textContent ?? '').replace(/\s+/g, '');
  });
}

async function keep(page: Page, testInfo: TestInfo, name: string, full = true): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ animations: 'disabled', caret: 'hide', path, fullPage: full });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['EXPLAIN_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

test.describe('S3: three depths', () => {
  test('B1 step 3: each depth shows its text; deep shows the query before and after and the CWE', async ({
    page,
  }) => {
    await openApp(page);
    const lesson = await lessonData(page, 'B1');
    expect(await run(page, 'player.goto', { step: 3 })).toEqual({ ok: true });
    const before = await playerOf(page);
    const current = currentStep(lesson.steps, false, 3);
    if (current === null) throw new Error('B1 has no step 3');
    await expect(page.getByTestId('explain-step')).toHaveText(
      `Шаг 3 из ${String(current.count)}. ${current.step.title}`,
    );

    // The default is «Просто».
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'simple');
    await expect(page.getByTestId('depth-simple')).toHaveAttribute('aria-selected', 'true');

    for (const depth of DEPTHS) {
      expect(await run(page, 'depth.set', { depth })).toEqual({ ok: true });
      await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', depth);
      await expect(page.getByTestId(`depth-${depth}`)).toHaveAttribute('aria-selected', 'true');
      const want = blocksText(current.step.levels[LEVEL[depth]]);
      expect(want.length).toBeGreaterThan(0);
      expect(await shownLevel(page)).toBe(want);
      // The other levels are not on screen.
      for (const other of DEPTHS.filter((d) => d !== depth)) {
        expect(await shownLevel(page)).not.toBe(blocksText(current.step.levels[LEVEL[other]]));
      }
      // Code only at «Глубже» (K72).
      await expect(page.getByTestId('explain-code')).toHaveCount(depth === 'deep' ? 2 : 0);
      // The step and the defence mode do not change.
      expect(await playerOf(page)).toEqual(before);
    }

    // At «Глубже»: the glued query (with its harmful part marked) and the parameterised one.
    const codes = page.getByTestId('explain-code');
    await expect(codes.nth(0)).toHaveAttribute('data-current', 'true');
    await expect(codes.nth(0).locator('figcaption')).toHaveText('Без защиты');
    await expect(codes.nth(1).locator('figcaption')).toHaveText('С защитой — для сравнения');
    const glued = current.step.code;
    if (glued === null) throw new Error('B1 step 3 has no code');
    await expect(codes.nth(0).locator('pre')).toHaveText(
      glued.segments.map((s) => s.text).join(''),
    );
    const marked = glued.segments.filter((s) => s.marked).map((s) => s.text);
    expect(marked.length).toBeGreaterThan(0);
    await expect(codes.nth(0).locator('mark')).toHaveText(marked);
    const param = stepsInMode(lesson.steps, true).find(
      (s) => s.mode === 'with-defence' && s.from === current.step.from && s.to === current.step.to,
    );
    if (param?.code == null) throw new Error('B1 has no parameterised query');
    await expect(codes.nth(1).locator('pre')).toHaveText(
      param.code.segments.map((s) => s.text).join(''),
    );
    // Both queries can be brought into view (on a laptop the panel scrolls, K73).
    for (const box of [codes.nth(0), codes.nth(1)]) {
      await box.scrollIntoViewIfNeeded();
      await expect(box).toBeInViewport();
    }
    // The CWE code is visible.
    const cwe = page.getByTestId('passport').locator('[data-key="cwe"] dd');
    await expect(cwe).toHaveText(lesson.passport.cwe.map((n) => `CWE-${String(n)}`).join(', '));
    await expect(cwe).toBeVisible();
    expect(lesson.passport.cwe).toContain(89);
  });

  test('every step of B1 and I1 has all three levels filled, in both modes', async ({ page }) => {
    await openApp(page);
    let checked = 0;
    for (const id of ['B1', 'I1']) {
      expect(await run(page, 'lesson.open', { id })).toEqual({ ok: true });
      await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', id);
      const lesson = await lessonData(page, id);
      for (const defence of [false, true]) {
        await run(page, 'defence.set', { on: defence });
        const steps = stepsInMode(lesson.steps, defence);
        for (let n = 1; n <= steps.length; n += 1) {
          await run(page, 'player.goto', { step: n });
          const step = steps[n - 1];
          if (step === undefined) throw new Error('no step');
          for (const depth of DEPTHS) {
            await run(page, 'depth.set', { depth });
            const want = blocksText(step.levels[LEVEL[depth]]);
            expect(want.length, `${id} ${step.id} ${depth}`).toBeGreaterThan(0);
            await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', depth);
            expect(await shownLevel(page), `${id} ${step.id} ${depth}`).toBe(want);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3 * 16);
  });

  test('the depth stays when the step, the mode or the lesson changes', async ({ page }) => {
    await openApp(page);
    await run(page, 'depth.set', { depth: 'deep' });
    await run(page, 'player.step');
    await run(page, 'defence.toggle');
    await run(page, 'player.back');
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'deep');
    await run(page, 'lesson.open', { id: 'I1' });
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'deep');
  });

  test('hostile parameters are invalid-params and change nothing', async ({ page }) => {
    await openApp(page);
    // The clock is not part of the question: a message may still be on its way.
    const view = () =>
      page.evaluate(() => {
        const state = window.__app?.state.get();
        return { depth: state?.depth, player: state?.player, lesson: state?.lesson };
      });
    const before = await view();
    for (const params of [
      undefined,
      {},
      { depth: 'detailed' },
      { depth: 3 },
      { depth: null },
      { depth: 'deep', more: true },
      { depth: 'x'.repeat(10_000) },
    ]) {
      expect(await run(page, 'depth.set', params)).toMatchObject({
        ok: false,
        error: { code: 'invalid-params' },
      });
    }
    expect(await view()).toEqual(before);
  });
});

test.describe('depth tabs', () => {
  test('a click and the arrows choose the depth; the player keys stay out of the tabs', async ({
    page,
  }) => {
    await openApp(page);
    await run(page, 'player.goto', { step: 2 });
    const before = await playerOf(page);

    await page.getByTestId('depth-deep').click();
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'deep');
    await expect(page.getByTestId('depth-deep')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'simple');
    await expect(page.getByTestId('depth-simple')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('depth-deep')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('depth-simple')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', 'deep');
    // Arrows in the tabs never stepped the player; only the selected tab is in the Tab order.
    expect(await playerOf(page)).toEqual(before);
    await expect(page.getByTestId('depth-deep')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('depth-simple')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByTestId('explain-text')).toHaveAttribute(
      'aria-labelledby',
      'depth-tab-deep',
    );
  });
});

test.describe('passport and sources', () => {
  test('B1: class, CWE, OWASP, severity in words, impact, defence, «Как защититься», sources', async ({
    page,
  }) => {
    await openApp(page);
    const lesson = await lessonData(page, 'B1');
    const row = (key: string) => page.getByTestId('passport').locator(`[data-key="${key}"] dd`);
    await expect(row('class')).toHaveText('Инъекция в запрос к базе данных');
    await expect(row('cwe')).toHaveText('CWE-89');
    await expect(row('owasp')).toHaveText('A03:2021');
    await expect(row('severity')).toHaveText('критическая');
    await expect(row('impact')).toHaveText(lesson.passport.impact ?? '');
    await expect(row('defence')).toHaveText(lesson.passport.defence ?? '');
    await expect(row('attack')).toHaveCount(0);
    await expect(page.getByTestId('explain-defence')).toBeVisible();
    const defence = await page
      .getByTestId('explain-defence')
      .locator('.blocks')
      .first()
      .textContent();
    expect((defence ?? '').replace(/\s+/g, '')).toBe(blocksText(lesson.defence ?? []));

    const links = page.getByTestId('sources').locator('a');
    await expect(links).toHaveCount(lesson.sources.length);
    for (const [i, source] of lesson.sources.entries()) {
      const link = links.nth(i);
      await expect(link).toHaveText(source.title);
      await expect(link).toHaveAttribute('href', source.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    // The sources are the only links that leave the site.
    const external = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('a[href]'))
          .filter(
            (a) => new URL(a.getAttribute('href') ?? '', location.href).origin !== location.origin,
          )
          .filter((a) => a.closest('[data-testid="sources"]') === null).length,
    );
    expect(external).toBe(0);
  });

  test('I1: the class from the lesson, ATT&CK techniques, severity «высокая»', async ({
    page,
  }, testInfo) => {
    await openApp(page);
    await run(page, 'lesson.open', { id: 'I1' });
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
    const row = (key: string) => page.getByTestId('passport').locator(`[data-key="${key}"] dd`);
    await expect(row('class')).toHaveText('Социальная инженерия');
    await expect(row('attack')).toHaveText('T1566, T1566.002');
    await expect(row('severity')).toHaveText('высокая');
    await expect(row('cwe')).toHaveCount(0);
    await sceneReady(page);
    await keep(page, testInfo, 'i1-passport-1280');
    // On a laptop the panel scrolls inside the top row (K73): the passport is reached there.
    await page.getByTestId('passport').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('passport')).toBeInViewport();
    await keep(page, testInfo, 'i1-passport-scrolled-1280');
  });
});

test.describe('S10: the panel on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('under the controls, tabs at least 44 px, no sideways scroll at any depth', async ({
    page,
  }) => {
    await openApp(page);
    await run(page, 'player.goto', { step: 3 });
    const controls = await page.getByTestId('player').boundingBox();
    const explain = await page.getByTestId('explain').boundingBox();
    if (controls === null || explain === null) throw new Error('missing region');
    expect(explain.y).toBeGreaterThanOrEqual(controls.y + controls.height);
    for (const depth of DEPTHS) {
      await run(page, 'depth.set', { depth });
      for (const tab of DEPTHS) {
        const box = await page.getByTestId(`depth-${tab}`).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      }
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sideways, depth).toBe(0);
    }
    // Long code lines scroll inside their own box.
    const boxes = page.getByTestId('explain-code').locator('pre');
    await expect(boxes).toHaveCount(2);
    for (const pre of await boxes.all()) {
      const box = await pre.boundingBox();
      expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 390).toBe(true);
    }
  });
});

// Screenshots for the look (oracle C, R-UI): B1 step 3 at each depth on a laptop and a phone.
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const) {
  test.describe(`screenshots at ${String(viewport.width)}`, () => {
    test.use({ viewport });
    test('B1 step 3 at each depth', async ({ page }, testInfo) => {
      await openApp(page);
      await page.evaluate(() => {
        window.__app?.clock.set(0);
        window.__app?.commands.run('player.goto', { step: 3 });
        window.__app?.clock.set(5000);
      });
      await sceneReady(page);
      for (const depth of DEPTHS as readonly Depth[]) {
        await run(page, 'depth.set', { depth });
        await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', depth);
        await keep(page, testInfo, `b1-step3-${depth}-${String(viewport.width)}`);
      }
    });
  });
}
