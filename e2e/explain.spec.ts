// M1.4 acceptance (oracle D): scenario S3 «Три уровня глубины» through the control channel, the
// tabs by mouse and keyboard, the passport (class, severity, sources) of B1 and I1, and the panel
// on a phone. G18: the three levels of every step of every lesson, in Russian and English. Expected texts come from the built lesson data, not from copies in the test.
// Screenshots go to EXPLAIN_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { SiteBlock, SiteInline, SiteLesson } from '../src/core/lesson/site';
import { currentStep, stepsInMode } from '../src/core/scene-layout/message';
import { type Lang, LANGS, LESSONS, lessonData as lessonOf } from './lessons';
import { expect, openApp, sceneReady, test } from './support';

const DEPTHS = ['simple', 'steps', 'deep'] as const;
type Depth = (typeof DEPTHS)[number];
const LEVEL = { simple: 'simple', steps: 'detailed', deep: 'deep' } as const;

async function lessonData(page: Page, id: string, lang: Lang = 'ru'): Promise<SiteLesson> {
  return lessonOf(page, id, lang);
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
    await expect(cwe).toHaveText(/^CWE-89\b/);
    await expect(cwe).toBeVisible();
    expect(lesson.passport.cwe).toContain(89);
  });

  // G18: S3 «у каждого шага заполнены все три уровня» for every lesson, in both languages; the
  // step number and the mode stay while the depth changes.
  for (const lang of LANGS) {
    for (const id of LESSONS) {
      test(`${lang} ${id}: every step has all three levels filled, in both modes; depth keeps the step`, async ({
        page,
      }) => {
        await openApp(page, `/${lang}/lesson/${id}`);
        await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', id);
        const lesson = await lessonData(page, id, lang);
        let checked = 0;
        for (const defence of [false, true]) {
          await run(page, 'defence.set', { on: defence });
          const steps = stepsInMode(lesson.steps, defence);
          expect(steps.length, `${id} ${lang}`).toBeGreaterThan(0);
          for (let n = 1; n <= steps.length; n += 1) {
            await run(page, 'player.goto', { step: n });
            const step = steps[n - 1];
            if (step === undefined) throw new Error('no step');
            for (const depth of DEPTHS) {
              await run(page, 'depth.set', { depth });
              const where = `${id} ${lang} ${step.id} ${depth}`;
              const want = blocksText(step.levels[LEVEL[depth]]);
              expect(want.length, where).toBeGreaterThan(0);
              await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', depth);
              expect(await shownLevel(page), where).toBe(want);
              expect(await playerOf(page), where).toMatchObject({ step: n, defence });
              checked += 1;
            }
          }
        }
        const total =
          stepsInMode(lesson.steps, false).length + stepsInMode(lesson.steps, true).length;
        expect(checked).toBe(3 * total);
      });
    }
  }

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
    await expect(row('cwe')).toHaveText('CWE-89 · SQL-инъекция');
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

// A valid lesson may hold words longer than a phone is wide: a 66-letter bold word, a link in
// prose, words of 3000 letters, a very long code line. The built B1 is changed on its way to
// the page (the checker accepts all of these). The file stays under the loader's 128 KB.
const LONG = 'А'.repeat(66);
const URL_IN_PROSE = `https://example.org/${'very-long-path/'.repeat(12)}index.html`;
const HUGE = 'W'.repeat(3000);
const LONG_LINE = `SELECT ${'column_name, '.repeat(60)}x FROM users`;

function hostile(lesson: Record<string, unknown>): Record<string, unknown> {
  const words = (bold: boolean, huge = false) => ({
    type: 'paragraph',
    children: [
      { type: 'text', value: 'Слово ' },
      bold
        ? { type: 'strong', children: [{ type: 'text', value: LONG }] }
        : { type: 'text', value: LONG },
      { type: 'text', value: ` ссылка ${URL_IN_PROSE} и ${huge ? HUGE : LONG}` },
      { type: 'code', value: `${LONG}${LONG}` },
    ],
  });
  const list = { type: 'list', ordered: false, items: [[words(false)], [words(true)]] };
  const code = {
    type: 'code',
    lang: 'sql',
    segments: [
      { text: LONG_LINE, marked: false },
      { text: 'x'.repeat(600), marked: true },
    ],
  };
  const steps = (lesson['steps'] as Record<string, unknown>[]).map((step) => ({
    ...step,
    code: step['code'] === null ? null : code,
    levels: {
      simple: [words(true, true)],
      detailed: [words(false), list],
      deep: [words(true), list, code],
    },
  }));
  const passport = lesson['passport'] as Record<string, unknown>;
  return {
    ...lesson,
    steps,
    passport: { ...passport, class: LONG, impact: `${HUGE} ${URL_IN_PROSE}`, defence: LONG },
    defence: [words(true, true), list],
    sources: [{ title: `${LONG} ${URL_IN_PROSE}`, url: `${URL_IN_PROSE}?q=${'x'.repeat(3000)}` }],
  };
}

async function openHostile(page: Page): Promise<void> {
  await page.route('**/data/lessons/B1.ru.*.json', async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as Record<string, unknown>;
    // A fresh answer: the original headers would declare the original length.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hostile(data)),
    });
  });
  await openApp(page);
  await expect(page.getByTestId('explain-step')).toBeVisible();
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
] as const) {
  test.describe(`hostile text at ${String(viewport.width)}`, () => {
    test.use({ viewport });

    test('long words, links and code lines never push the page or the panel sideways', async ({
      page,
    }) => {
      await openHostile(page);
      await expect(page.getByTestId('passport').locator('[data-key="class"] dd')).toHaveText(LONG);
      for (const defence of [false, true]) {
        await run(page, 'defence.set', { on: defence });
        for (const step of [1, 3]) {
          await run(page, 'player.goto', { step });
          for (const depth of DEPTHS) {
            await run(page, 'depth.set', { depth });
            await expect(page.getByTestId('explain-text')).toHaveAttribute('data-depth', depth);
            const where = `${String(defence)} step ${String(step)} ${depth}`;
            const widths = await page.evaluate(() => {
              const root = document.documentElement;
              const panel = document.querySelector<HTMLElement>('[data-testid="explain"]');
              const inner = Array.from(
                document.querySelectorAll<HTMLElement>('[data-testid="explain"] *'),
              )
                // Code boxes scroll by design; the hidden heading is 1 px wide by design.
                .filter((el) => el.closest('pre') === null && !el.matches('.visually-hidden'))
                .filter((el) => el.scrollWidth > el.clientWidth + 1);
              return {
                page: root.scrollWidth - root.clientWidth,
                panel: panel === null ? -1 : panel.scrollWidth - panel.clientWidth,
                inner: inner.map((el) => el.tagName),
              };
            });
            expect(widths.page, `page, ${where}`).toBe(0);
            expect(widths.panel, `panel, ${where}`).toBe(0);
            expect(widths.inner, `parts of the panel, ${where}`).toEqual([]);
          }
        }
      }
      // Only the code boxes scroll sideways, inside themselves.
      await run(page, 'depth.set', { depth: 'deep' });
      const pre = page.getByTestId('explain-code-text').first();
      const scrolls = await pre.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scrolls).toBe(true);
    });
  });
}

test.describe('keys inside the panel (K69)', () => {
  test('Space on the focused panel scrolls it; arrows on a code box scroll it, not the player', async ({
    page,
  }) => {
    await openHostile(page);
    await run(page, 'player.goto', { step: 3 });
    const before = await playerOf(page);

    const panel = page.getByTestId('explain');
    await panel.focus();
    await page.keyboard.press(' ');
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    expect(await playerOf(page)).toEqual(before);

    await run(page, 'depth.set', { depth: 'deep' });
    const pre = page.getByTestId('explain-code-text').first();
    await pre.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => pre.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await page.keyboard.press(' ');
    expect(await playerOf(page)).toEqual(before);

    // D is not a scrolling key: it still toggles the defence from the panel.
    await panel.focus();
    await page.keyboard.press('d');
    expect((await playerOf(page))?.defence).toBe(true);
  });
});

test.describe('the panel at 1280×720 (K73)', () => {
  test('shows «Ниже ещё ↓» while there is more below, and the current query without scrolling', async ({
    page,
  }) => {
    await openApp(page);
    const panel = page.getByTestId('explain');
    await expect(page.getByTestId('explain-more')).toBeVisible();
    await expect(page.getByTestId('explain-more')).toHaveText('Ниже ещё ↓');
    await panel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByTestId('explain-more')).toHaveCount(0);
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(page.getByTestId('explain-more')).toBeVisible();

    await run(page, 'depth.set', { depth: 'deep' });
    for (const defence of [false, true]) {
      await run(page, 'defence.set', { on: defence });
      // Step 3 is the glued query without the defence and the parameterised one with it.
      await run(page, 'player.goto', { step: 3 });
      await panel.evaluate((el) => {
        el.scrollTop = 0;
      });
      const own = page.locator('[data-testid="explain-code"][data-current="true"] pre');
      await expect(own).toHaveCount(1);
      const [p, c] = await Promise.all([panel.boundingBox(), own.boundingBox()]);
      if (p === null || c === null) throw new Error('no box');
      expect(c.y, `defence ${String(defence)}`).toBeGreaterThanOrEqual(p.y);
      expect(c.y + c.height, `defence ${String(defence)}`).toBeLessThanOrEqual(p.y + p.height);
      // The hint does not cover it.
      const hint = await page.getByTestId('explain-more').boundingBox();
      if (hint !== null) expect(c.y + c.height).toBeLessThanOrEqual(hint.y + hint.height / 2);
    }
  });

  test('a phone has no hint: the panel does not scroll there', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    await expect(page.getByTestId('explain-step')).toBeVisible();
    await expect(page.getByTestId('explain-more')).toHaveCount(0);
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
