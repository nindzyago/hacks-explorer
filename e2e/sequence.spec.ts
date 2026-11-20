// M6.2 (design M6 §5, oracle C · D S1 S2): the sequence view. On every lesson in Russian and
// English at 1280×720 and 390×844: one row per step of the current course, the current row
// highlighted, a click on a row goes to its step, the defence switches the rows; no label is cut
// by the view or laid over another, nothing scrolls sideways; axe WCAG 2.2 AA finds nothing.
// S1 and S2 as written, played in this view; the switch, the keyboard, the live caption, the
// moving arrow and reduced motion (S11).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { stableDump } from '../src/core/dump';
import { stepsInMode } from '../src/core/scene-layout/message';
import { LANGS, LESSONS, lessonData } from './lessons';
import { expect, openApp, test } from './support';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const SIZES = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function dump(page: Page): Promise<string> {
  const result = stableDump(await page.evaluate(() => window.__app?.state.get()));
  if (!result.ok) throw new Error(result.error.message);
  return result.text;
}

async function axe(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const found = result.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(found, label).toEqual([]);
}

/** Lesson `id` open in `lang`, its steps known, the clock at 0, the sequence view on. */
async function open(page: Page, lang: string, id: string): Promise<void> {
  await openApp(page, `/${lang}/lesson/${id}`);
  await page.evaluate(() => window.__app?.clock.set(0));
  await expect(page.getByTestId('step-row-1')).toBeVisible();
  await run(page, 'view.set', { view: 'sequence' });
  await expect(page.getByTestId('sequence')).toHaveAttribute('data-lesson', id);
  await expect(page.getByTestId('scene')).toHaveCount(0);
}

const rows = (page: Page) =>
  page.locator('[data-testid="sequence"] g[data-testid^="sequence-row-"]');

/**
 * Problems of the drawing as it is: text outside the view or outside its label box, label boxes
 * laid over each other, names over their neighbours, sideways scroll of the page or the view.
 */
async function drawingProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.querySelector('[data-testid="sequence"]');
    const svg = root?.querySelector('.area > svg');
    const area = root?.querySelector('[data-testid="sequence-area"]');
    if (!root || !svg || !area) return ['no sequence view'];
    const view = svg.getBoundingClientRect();
    const box = (e: Element) => e.getBoundingClientRect();
    const within = (a: DOMRect, b: DOMRect, slack = 1) =>
      a.left >= b.left - slack &&
      a.right <= b.right + slack &&
      a.top >= b.top - slack &&
      a.bottom <= b.bottom + slack;
    const meets = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    for (const text of Array.from(svg.querySelectorAll('text[data-part]'))) {
      const r = box(text);
      const what = `${text.getAttribute('data-part') ?? '?'} «${text.textContent}»`;
      if (!within(r, view)) problems.push(`${what} outside the view`);
    }
    const boxes = Array.from(svg.querySelectorAll('g[data-testid^="sequence-row-"]')).map((row) => {
      const labelBox = row.querySelector('[data-part="label-box"]');
      const label = row.querySelector('text[data-part="label"]');
      const separator = row.querySelector('text[data-part="separator"]');
      const name = row.getAttribute('data-testid') ?? '?';
      if (!labelBox) return null;
      const lb = box(labelBox);
      if (label && label.textContent.trim() !== '' && !within(box(label), lb)) {
        const r = box(label);
        problems.push(
          `${name}: label «${label.textContent}» outside its box (${[r.left, r.right, r.top, r.bottom, lb.left, lb.right, lb.top, lb.bottom].map((n) => n.toFixed(1)).join(' ')})`,
        );
      }
      if (separator && meets(box(separator), lb)) {
        problems.push(`${name}: separator over the label`);
      }
      return { name, lb };
    });
    const list = boxes.filter((b) => b !== null);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a && b && meets(a.lb, b.lb)) problems.push(`${a.name} label over ${b.name}`);
      }
    }
    const lanes = Array.from(svg.querySelectorAll('g[data-testid^="sequence-lane-"]'));
    const names = lanes.flatMap((lane) =>
      Array.from(lane.querySelectorAll('text[data-part="name"], text[data-part="note"]')).map(
        (t) => ({ lane: lane.getAttribute('data-testid') ?? '?', r: box(t) }),
      ),
    );
    for (const a of names) {
      for (const b of names) {
        if (a.lane < b.lane && meets(a.r, b.r)) problems.push(`${a.lane} name over ${b.lane}`);
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth) {
      problems.push(`the page scrolls sideways: ${String(document.documentElement.scrollWidth)}`);
    }
    if (area.scrollWidth > area.clientWidth) problems.push('the view scrolls sideways');
    if (view.right > box(root).right + 1) problems.push('the drawing is wider than the view');
    return problems;
  });
}

for (const id of LESSONS) {
  test(`${id}: one row per step of the course, current highlighted, click, defence, drawing, axe`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      for (const lang of LANGS) {
        const where = `${id} ${lang} ${String(size.width)}`;
        await open(page, lang, id);
        const data = await lessonData(page, id, lang);
        for (const defence of [false, true]) {
          const label = `${where} ${defence ? 'with' : 'without'} defence`;
          await run(page, 'defence.set', { on: defence });
          const steps = stepsInMode(data.steps, defence);
          await expect(page.getByTestId('sequence')).toHaveAttribute(
            'data-defence',
            String(defence),
          );
          await expect(rows(page), label).toHaveCount(steps.length);
          expect(
            await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-step'))),
            label,
          ).toEqual(steps.map((s) => s.id));
          // The lanes are the participants, in scene order.
          expect(
            await page
              .locator('[data-testid^="sequence-lane-"]')
              .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))),
          ).toEqual(data.participants.map((p) => `sequence-lane-${p.id}`));
          // The current row is highlighted and named so.
          const middle = Math.ceil(steps.length / 2);
          await run(page, 'player.goto', { step: middle });
          await expect(page.getByTestId(`sequence-row-${String(middle)}`)).toHaveAttribute(
            'data-state',
            'current',
          );
          await expect(page.getByTestId(`sequence-goto-${String(middle)}`)).toHaveAttribute(
            'aria-current',
            'step',
          );
          expect(
            await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-state'))),
          ).toEqual(
            steps.map((_, i) =>
              i + 1 < middle ? 'past' : i + 1 === middle ? 'current' : 'future',
            ),
          );
          expect(await drawingProblems(page), label).toEqual([]);
          // A click on a row goes to its step.
          for (const n of [steps.length, 1]) {
            const target = page.getByTestId(`sequence-goto-${String(n)}`);
            await target.scrollIntoViewIfNeeded();
            await target.click();
            await expect
              .poll(() => page.evaluate(() => window.__app?.state.get().player.step), label)
              .toBe(n);
            await expect(page.getByTestId(`sequence-row-${String(n)}`)).toHaveAttribute(
              'data-state',
              'current',
            );
          }
          await run(page, 'player.goto', { step: steps.length });
          await page.evaluate(() => window.__app?.clock.set(10_000));
          expect(await drawingProblems(page), `${label} last step`).toEqual([]);
          await axe(page, label);
          await page.evaluate(() => window.__app?.clock.set(0));
        }
      }
    }
  });
}

test.describe('S1 and S2 in the sequence view', () => {
  test('S1: three steps forward, four rows happened, back gives exactly the state of step 3', async ({
    page,
  }) => {
    await open(page, 'ru', 'B1');
    await run(page, 'defence.set', { on: false });
    await run(page, 'player.goto', { step: 1 });
    await run(page, 'player.step');
    await run(page, 'player.step');
    const atThree = await dump(page);
    await run(page, 'player.step');
    await expect(page.getByTestId('sequence-row-4')).toHaveAttribute('data-state', 'current');
    await run(page, 'player.back');
    expect(await dump(page)).toBe(atThree);
    await expect(page.getByTestId('sequence-row-3')).toHaveAttribute('data-state', 'current');
    await run(page, 'player.step');
    await expect(page.getByTestId('sequence-row-4')).toHaveAttribute('data-state', 'current');
    expect(
      await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-state'))),
    ).toEqual(['past', 'past', 'past', 'current', 'future']);
    // The arrow of step 4 ends at the lane of the database.
    await page.evaluate(() => window.__app?.clock.tick(2000));
    const row = page.getByTestId('sequence-row-4');
    const to = (await row.getAttribute('data-to')) ?? '';
    const ends = await page.evaluate((t) => {
      const arrow = document.querySelector('[data-testid="sequence-arrow-4"]');
      const lane = document.querySelector(`[data-testid="sequence-lane-${t}"] .lifeline`);
      return [Number(arrow?.getAttribute('x2')), Number(lane?.getAttribute('x1'))];
    }, to);
    expect(ends[0]).toBeCloseTo(ends[1] ?? Number.NaN, 0);
  });

  test('S2: with the defence the harmful row ends green with a stop; toggling back restores', async ({
    page,
  }) => {
    await open(page, 'ru', 'B1');
    const data = await lessonData(page, 'B1', 'ru');
    const without = stepsInMode(data.steps, false).map((s) => s.id);
    const withDefence = stepsInMode(data.steps, true);
    await run(page, 'defence.toggle');
    expect(
      await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-step'))),
    ).toEqual(withDefence.map((s) => s.id));
    await run(page, 'player.play');
    for (let i = 0; i < withDefence.length + 1; i += 1) {
      await page.evaluate(() => window.__app?.clock.tick(2400));
    }
    const stopped = withDefence.flatMap((s, i) => (s.stopped ? [i + 1] : []));
    expect(stopped.length).toBeGreaterThan(0);
    for (const n of stopped) {
      await expect(page.getByTestId(`sequence-row-${String(n)}`)).toHaveAttribute(
        'data-paint',
        'stopped',
      );
      await expect(page.getByTestId(`sequence-stop-${String(n)}`)).toHaveCount(1);
    }
    const step = await page.evaluate(() => window.__app?.state.get().player.step);
    await run(page, 'defence.toggle');
    expect(
      await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-step'))),
    ).toEqual(without);
    expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(
      Math.min(step ?? 0, without.length),
    );
    await expect(page.locator('[data-testid^="sequence-stop-"]')).toHaveCount(0);
  });
});

test.describe('the sequence view', () => {
  test('the switch runs view.set; the view stays over a change of lesson and language; the address does not change', async ({
    page,
  }) => {
    await openApp(page, '/ru/lesson/B1');
    await run(page, 'player.goto', { step: 3 });
    const address = page.url();
    // The tabs sit in the head of the scene panel (M6.1) and control its body.
    const tabs = page.getByTestId('scene-panel').getByRole('tablist');
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await expect(page.getByTestId('view-scene')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('view-sequence')).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByTestId('legend-future')).toHaveCount(0);
    await page.getByTestId('view-sequence').click();
    await expect(page.getByTestId('sequence')).toBeVisible();
    await expect(page.getByTestId('scene')).toHaveCount(0);
    await expect(page.getByTestId('view-sequence')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('view-sequence')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('view-scene')).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#view-panel')).toHaveAttribute(
      'aria-labelledby',
      'view-tab-sequence',
    );
    await expect(page.getByTestId('legend-future')).toBeVisible();
    await expect(page.getByTestId('sequence')).toHaveCSS('border-top-width', '0px');
    expect(page.url()).toBe(address);
    // ← and → move between the tabs and take the focus; the player keeps its step.
    await page.getByTestId('view-sequence').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('scene')).toBeVisible();
    await expect(page.getByTestId('view-scene')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('sequence')).toBeVisible();
    await expect(page.getByTestId('view-sequence')).toBeFocused();
    expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(3);
    expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(3);
    await run(page, 'lesson.open', { id: 'I1' });
    await expect(page.getByTestId('sequence')).toHaveAttribute('data-lesson', 'I1');
    await run(page, 'locale.set', { lang: 'en' });
    await expect(page.getByTestId('view-sequence')).toHaveText('Sequence');
    await expect(page.getByTestId('sequence')).toBeVisible();
    await page.getByTestId('view-scene').click();
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
    await expect(page.getByTestId('sequence')).toHaveCount(0);
  });

  test('a row is a button: Enter goes to its step, the focus shows the ring, Space plays', async ({
    page,
  }) => {
    await open(page, 'ru', 'B1');
    const ring = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--legit)';
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    const row = page.getByTestId('sequence-goto-2');
    await expect(row).toHaveAttribute('role', 'button');
    expect(((await row.getAttribute('aria-label')) ?? '').startsWith('Шаг 2 из 5.')).toBe(true);
    await row.focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__app?.state.get().player.step)).toBe(2);
    expect(
      await row.evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
      }),
    ).toBe(`solid 3px ${ring}`);
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.__app?.state.get().player.playing)).toBe(true);
    // The group is named and holds a button per row.
    await expect(page.getByRole('group', { name: /Последовательность сообщений/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Шаг \d из 5\./ })).toHaveCount(5);
  });

  test('the current step is said once per step in a polite live region', async ({ page }) => {
    await open(page, 'ru', 'B1');
    const live = page.getByTestId('sequence-step');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toContainText('Шаг 1 из 5.');
    await live.evaluate((el) => {
      const w = window as unknown as { __live: number };
      w.__live = 0;
      new MutationObserver((records) => {
        w.__live += records.length;
      }).observe(el, { childList: true, subtree: true, characterData: true });
    });
    for (let ms = 0; ms <= 1200; ms += 100) {
      await page.evaluate((t) => window.__app?.clock.set(t), ms);
    }
    expect(await page.evaluate(() => (window as unknown as { __live: number }).__live)).toBe(0);
    await run(page, 'player.step');
    await expect(live).toContainText('Шаг 2 из 5.');
  });

  test('the current arrow grows from the sender on the player clock', async ({ page }) => {
    await open(page, 'ru', 'B1');
    await run(page, 'player.goto', { step: 2 });
    const t0 = await page.evaluate(() => window.__app?.state.get().player.startedMs ?? 0);
    const x = () =>
      page.evaluate(() => {
        const a = document.querySelector('[data-testid="sequence-arrow-2"]');
        return [Number(a?.getAttribute('x1')), Number(a?.getAttribute('x2'))];
      });
    await page.evaluate((t) => window.__app?.clock.set(t), t0);
    const [startX1, startX2] = await x();
    expect(startX2).toBeCloseTo(startX1 ?? Number.NaN, 0);
    await page.evaluate((t) => window.__app?.clock.set(t + 450), t0);
    const [, half] = await x();
    await page.evaluate((t) => window.__app?.clock.set(t + 900), t0);
    const [, full] = await x();
    expect(Math.abs((half ?? 0) - (startX1 ?? 0))).toBeGreaterThan(1);
    expect(Math.abs((full ?? 0) - (startX1 ?? 0))).toBeGreaterThan(
      Math.abs((half ?? 0) - (startX1 ?? 0)),
    );
  });

  test('S11: with reduced motion the arrow is whole at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'ru', 'B1');
    await run(page, 'player.goto', { step: 2 });
    const data = await lessonData(page, 'B1', 'ru');
    const step = stepsInMode(data.steps, false)[1];
    const ends = await page.evaluate((to) => {
      const a = document.querySelector('[data-testid="sequence-arrow-2"]');
      const lane = document.querySelector(`[data-testid="sequence-lane-${to}"] .lifeline`);
      return [Number(a?.getAttribute('x2')), Number(lane?.getAttribute('x1'))];
    }, step?.to ?? '');
    expect(ends[0]).toBeCloseTo(ends[1] ?? Number.NaN, 0);
  });

  test('at 1280×720 the page still fits the window in the sequence view', async ({ page }) => {
    for (const id of LESSONS) {
      await open(page, 'ru', id);
      const fits = await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      );
      expect(fits, id).toBe(true);
    }
  });
});
