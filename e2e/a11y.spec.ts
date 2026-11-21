// M2.7 acceptance (oracle D S6 S11, plus axe-core): accessibility of every screen and state.
//   - axe-core with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing on ru and en: every lesson (G18)
//     at the first, a middle and the last step, with and without the defence, at every depth
//     (CI7: the states listed at the test, K136); the side panel on both tabs; a glossary
//     definition open; the «no such page» page; the explanation panel scrolled to its sources at
//     phone widths;
//   - the scene's term buttons are in the accessibility tree with names (not hidden inside an
//     image), and the scene says the current step in a polite live region that changes once per
//     step, not on every frame of the clock;
//   - S6 as written: focus on the page, Space → ← D; every control on the page is reachable with
//     Tab in reading order, and the focused one always shows the ring of the tokens;
//   - S11 as written: with reduced motion `player.step` puts the message at its target at once,
//     with no movement while the clock runs; the state is the same as in S1.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { stableDump } from '../src/core/dump';
import { LESSONS as ALL_LESSONS } from './lessons';
import { expect, openApp, test } from './support';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

/** Rule ids and the first nodes of every axe violation on the page as it is now. */
async function axe(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const found = result.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(found, label).toEqual([]);
}

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function counts(page: Page): Promise<{ without: number; with: number }> {
  const c = await page.evaluate(() => window.__app?.state.get().player.counts);
  if (c === undefined) throw new Error('no app');
  return c;
}

async function dump(page: Page): Promise<string> {
  const result = stableDump(await page.evaluate(() => window.__app?.state.get()));
  if (!result.ok) throw new Error(result.error.message);
  return result.text;
}

/** A lesson open with its steps known and the clock stopped at 0. */
async function lesson(page: Page, path: string): Promise<void> {
  await openApp(page, path);
  await page.evaluate(() => window.__app?.clock.set(0));
  await expect.poll(async () => (await counts(page)).without).toBeGreaterThan(0);
}

const LOCALES = ['ru', 'en'] as const;
// G18: every lesson in content/lessons.
const LESSONS = ALL_LESSONS;

// CI7: axe runs at the states that differ for it, not at every combination. Per lesson and
// language: each mode at its first step at rest, its middle step on the way (the message and its
// plaque over the scene) and its last step at rest; the depths «steps» and «deep» at step 2
// («simple» is the depth of the mode checks). Every step, every depth and every width get the
// layout checks (phone, phone-screens, one-screen, scene); axe sees the DOM, which does not
// change with the moment of the clock beyond «on the way» and «at rest».
test.describe('axe finds no WCAG A/AA violations', () => {
  for (const locale of LOCALES) {
    for (const id of LESSONS) {
      for (const defence of [false, true]) {
        test(`${locale} ${id} ${defence ? 'with' : 'without'} defence: first, middle, last step`, async ({
          page,
        }) => {
          await lesson(page, `/${locale}/lesson/${id}`);
          await run(page, 'defence.set', { on: defence });
          const c = await counts(page);
          const last = defence ? c.with : c.without;
          const middle = Math.ceil(last / 2);
          const states: [number, number, string][] = [
            [1, 5000, 'at rest'],
            [middle, 450, 'on the way'],
            [last, 5000, 'at rest'],
          ];
          for (const [step, ms, moment] of states) {
            await page.evaluate(() => window.__app?.clock.set(0));
            await run(page, 'player.goto', { step });
            await page.evaluate((t) => window.__app?.clock.set(t), ms);
            await axe(page, `${locale} ${id} step ${String(step)} ${moment}`);
          }
        });
      }

      test(`${locale} ${id}: the depths «steps» and «deep»`, async ({ page }) => {
        await lesson(page, `/${locale}/lesson/${id}`);
        await run(page, 'player.goto', { step: 2 });
        for (const depth of ['steps', 'deep']) {
          await run(page, 'depth.set', { depth });
          await expect(page.getByTestId(`depth-${depth}`)).toHaveAttribute('aria-selected', 'true');
          await axe(page, `${locale} ${id} depth ${depth}`);
        }
      });
    }

    test(`${locale}: the side panel on both tabs`, async ({ page }) => {
      await lesson(page, `/${locale}/lesson/B1`);
      await run(page, 'drawer.open', { tab: 'lessons' });
      await expect(page.getByTestId('drawer')).toBeVisible();
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await axe(page, `${locale} panel lessons`);
      await run(page, 'drawer.open', { tab: 'glossary' });
      await expect(page.getByTestId('glossary-search')).toBeVisible();
      await axe(page, `${locale} panel glossary`);
      await run(page, 'glossary.open', { id: 'sql' });
      await expect(page.getByTestId('glossary-entry')).toBeVisible();
      await axe(page, `${locale} panel glossary entry`);
    });

    test(`${locale}: a glossary definition open on the lesson`, async ({ page }) => {
      await lesson(page, `/${locale}/lesson/B1`);
      await run(page, 'glossary.open', { id: 'sql' });
      await expect(page.getByTestId('glossary-popover')).toBeVisible();
      await expect(page.getByTestId('glossary-definition')).toBeVisible();
      await axe(page, `${locale} glossary popover`);
    });

    test(`${locale}: the «no such page» page`, async ({ page }) => {
      await page.goto(`/${locale}/lesson/B1/extra`);
      await expect(page.getByTestId('page-not-found')).toBeVisible();
      await axe(page, `${locale} not found`);
    });
  }
});

/** What Chromium gives assistive technology: role and name of every node under the scene. */
async function sceneTree(page: Page): Promise<{ role: string; name: string }[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const out: { role: string; name: string }[] = [];
  for (const node of nodes) {
    if (node.ignored) continue;
    const role = typeof node.role?.value === 'string' ? node.role.value : '';
    const name = typeof node.name?.value === 'string' ? node.name.value : '';
    out.push({ role, name });
  }
  return out;
}

// CI7: one page per lesson and language, resized from 360 to 390 px; axe at 360 px, the
// narrowest (its target-size rule is the one that depends on the width), the link heights at both.
test.describe('the sources at phone widths', () => {
  for (const locale of LOCALES) {
    for (const id of LESSONS) {
      test(`${locale} ${id} at 360 and 390 px: axe, links at least 24 px tall`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await lesson(page, `/${locale}/lesson/${id}`);
        await run(page, 'depth.set', { depth: 'deep' });
        for (const width of [360, 390]) {
          await page.setViewportSize({ width, height: 800 });
          const links = page.locator('a[data-testid^="source-link-"]');
          expect(await links.count()).toBeGreaterThan(0);
          await links.last().scrollIntoViewIfNeeded();
          for (const box of await links.evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().height),
          )) {
            expect(box, `${locale} ${id} ${String(width)} px`).toBeGreaterThanOrEqual(24);
          }
          if (width === 360) await axe(page, `${locale} ${id} ${String(width)} px`);
        }
      });
    }
  }
});

test.describe('the scene for a screen reader', () => {
  test('its term buttons are reachable and named; the scene is a labelled group', async ({
    page,
  }) => {
    await lesson(page, '/ru/lesson/B1');
    const terms = page.locator('[data-testid^="participant-term-"], [data-testid^="zone-term-"]');
    const labels = await terms.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label') ?? ''),
    );
    expect(labels.length).toBeGreaterThan(0);
    const tree = await sceneTree(page);
    for (const label of labels) {
      expect(tree, `button «${label}»`).toContainEqual({ role: 'button', name: label });
    }
    // The scene is named by its title, as before.
    const title = await page.getByTestId('scene').locator('title').first().textContent();
    expect(tree).toContainEqual({ role: 'group', name: title ?? '' });
    // And the Playwright role engine finds the buttons too.
    for (const label of labels) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(1);
    }
  });

  test('the current step is said in a polite live region once per step, not per frame', async ({
    page,
  }) => {
    await lesson(page, '/ru/lesson/B1');
    await run(page, 'player.goto', { step: 1 });
    const live = page.getByTestId('scene-step');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toContainText('Шаг 1 из 5.');
    // The caption is in the accessibility tree with the step text: a screen reader can say it.
    const caption = ((await live.textContent()) ?? '').trim();
    expect(caption.length).toBeGreaterThan(10);
    const said = (await sceneTree(page)).filter((n) => n.name.trim() === caption);
    expect(said, `«${caption}» exposed`).not.toEqual([]);
    await live.evaluate((el) => {
      const w = window as unknown as { __liveChanges: number };
      w.__liveChanges = 0;
      new MutationObserver((records) => {
        w.__liveChanges += records.length;
      }).observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    // The message travels: many frames of the clock inside step 1.
    for (let ms = 0; ms <= 2000; ms += 50) {
      await page.evaluate((t) => window.__app?.clock.set(t), ms);
    }
    expect(
      await page.evaluate(() => (window as unknown as { __liveChanges: number }).__liveChanges),
    ).toBe(0);
    await run(page, 'player.step');
    await expect(live).toContainText('Шаг 2 из 5.');
    expect(
      await page.evaluate(() => (window as unknown as { __liveChanges: number }).__liveChanges),
    ).toBeGreaterThan(0);
  });
});

/** Outline of the focused element, or '' when nothing but the page has focus. */
async function focused(page: Page): Promise<{ key: string; ring: string } | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return null;
    const s = getComputedStyle(el);
    // Each element gets its own number the first time it has focus.
    const w = window as unknown as { __focusIds?: WeakMap<Element, number>; __focusN?: number };
    w.__focusIds ??= new WeakMap();
    let n = w.__focusIds.get(el);
    if (n === undefined) {
      n = (w.__focusN ?? 0) + 1;
      w.__focusN = n;
      w.__focusIds.set(el, n);
    }
    const key = `${el.getAttribute('data-testid') ?? el.tagName.toLowerCase()}:${String(n)}`;
    return { key, ring: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}` };
  });
}

test.describe('S6: the keyboard', () => {
  test('focus on the page: Space, →, ←, D run play/pause, step, back, defence', async ({
    page,
  }) => {
    await lesson(page, '/ru/lesson/B1');
    await run(page, 'player.goto', { step: 2 });
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    const player = () => page.evaluate(() => window.__app?.state.get().player);
    await page.keyboard.press('Space');
    expect(await player()).toMatchObject({ playing: true });
    await page.keyboard.press('Space');
    expect(await player()).toMatchObject({ playing: false });
    await page.keyboard.press('ArrowRight');
    expect(await player()).toMatchObject({ step: 3 });
    await page.keyboard.press('ArrowLeft');
    expect(await player()).toMatchObject({ step: 2 });
    await page.keyboard.press('d');
    expect(await player()).toMatchObject({ step: 2, defence: true });
  });

  for (const locale of LOCALES) {
    test(`${locale}: Tab reaches every control once, in reading order, each with the ring`, async ({
      page,
    }) => {
      await lesson(page, `/${locale}/lesson/B1`);
      const ring = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.color = 'var(--legit)';
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      });
      // Everything the page lets the keyboard reach.
      const expected = await page.evaluate(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement | SVGElement>(
              'a[href], button, input, select, textarea, [tabindex]',
            ),
          ).filter((el) => {
            if (el.tabIndex < 0 || el.closest('[inert], [hidden], dialog:not([open])'))
              return false;
            if (el instanceof HTMLButtonElement && el.disabled) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          }).length,
      );
      expect(expected).toBeGreaterThan(5);
      const seen: string[] = [];
      // M5.1: reading order is checked by panel, not by screen position. The lessons column,
      // the explanation and the log scroll on their own and the section chips are sticky, so a
      // y position mixes scroll offsets. Instead: every panel is visited once, as one block, in
      // the order of the one-screen grid (top bar, lessons, scene, explanation, log).
      const regions: string[] = [];
      for (let i = 0; i < expected; i += 1) {
        await page.keyboard.press('Tab');
        const f = await focused(page);
        expect(f, `Tab ${String(i + 1)}`).not.toBeNull();
        if (f === null) break;
        expect(f.ring, f.key).toBe(`solid 3px ${ring}`);
        expect(seen, `${f.key} twice: a trap or a loop`).not.toContain(f.key);
        seen.push(f.key);
        const region = await page.evaluate(() => {
          const el = document.activeElement;
          const panel = el?.closest(
            '[data-testid="lessons-panel"], [data-testid="scene-panel"], [data-testid="explain"], [data-testid="log"], .controls-panel',
          );
          if (panel === null || panel === undefined) return 'top';
          if (panel.classList.contains('controls-panel')) return 'controls';
          return panel.getAttribute('data-testid') ?? 'top';
        });
        if (regions.at(-1) !== region) {
          expect(regions, `${region} entered twice: ${seen.join(', ')}`).not.toContain(region);
          regions.push(region);
        }
      }
      const order = ['top', 'lessons-panel', 'scene-panel', 'controls', 'explain', 'log'];
      expect(regions, seen.join(', ')).toEqual(order.filter((r) => regions.includes(r)));
      expect(regions).toEqual(
        expect.arrayContaining(['top', 'lessons-panel', 'scene-panel', 'explain', 'log']),
      );
      // One more Tab leaves the page's controls: no trap.
      await page.keyboard.press('Tab');
      const after = await focused(page);
      expect(after === null || !seen.slice(1).includes(after.key), 'no trap').toBe(true);
    });
  }

  test('the scene term buttons show the ring when tabbed to', async ({ page }) => {
    await lesson(page, '/ru/lesson/B1');
    const button = page.locator('[data-testid^="participant-term-"]').first();
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    const style = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle} ${s.outlineWidth}`;
    });
    expect(style).toBe('solid 3px');
  });
});

test.describe('S11: animation is off in the system', () => {
  test.use({ reducedMotion: 'reduce' });

  test('player.step puts the message at its target at once, with no movement', async ({ page }) => {
    await lesson(page, '/ru/lesson/B1');
    await run(page, 'player.goto', { step: 1 });
    await run(page, 'player.step');
    const message = page.getByTestId('message');
    await expect(message).toHaveAttribute('data-progress', '1');
    await expect(message).toHaveAttribute('data-arrived', 'true');
    const to = (await message.getAttribute('data-to')) ?? '';
    const at = async () => {
      const box = await page.locator('[data-testid="message-plaque"] .plaque').boundingBox();
      if (box === null) throw new Error('no plaque');
      return box.x + box.width / 2;
    };
    const icon = await page
      .getByTestId(`participant-${to}`)
      .locator('[data-part="icon"]')
      .boundingBox();
    if (icon === null) throw new Error('no icon');
    const start = await at();
    expect(Math.abs(start - (icon.x + icon.width / 2))).toBeLessThan(1);
    // The clock runs through the step: the message does not move.
    for (const ms of [100, 300, 450, 700, 900, 2000]) {
      await page.evaluate((t) => window.__app?.clock.set(t), ms);
      expect(await at(), `at ${String(ms)} ms`).toBe(start);
    }
  });

  test('the state is the same as in S1', async ({ page }) => {
    const s1 = async () => {
      await lesson(page, '/ru/lesson/B1');
      await run(page, 'player.goto', { step: 1 });
      for (let i = 0; i < 3; i += 1) await run(page, 'player.step');
      return dump(page);
    };
    const reduced = await s1();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const normal = await s1();
    expect(reduced).toBe(normal);
    expect(JSON.parse(reduced)).toMatchObject({ player: { step: 4 } });
  });
});
