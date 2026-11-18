// M1.3 acceptance (oracle D): S1 «урок проходит по шагам» and S6 «клавиатура» through the
// control channel, the player's buttons, autoplay by the player clock, the one-screen layout of
// K7 on a laptop and on a phone (S10). Screenshots go to PLAYER_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { stableDump } from '../src/core/dump';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const TRAVEL_MS = 900;
const STEP_MS = 900 + 1500;

async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['PLAYER_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

/** The state as text with sorted keys: two equal texts are exactly the same state. */
async function dump(page: Page): Promise<string> {
  const result = stableDump(await page.evaluate(() => window.__app?.state.get()));
  if (!result.ok) throw new Error(result.error.message);
  return result.text;
}

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function player(page: Page) {
  return page.evaluate(() => window.__app?.state.get().player);
}

/** B1 open, step 1, defence off, clock stopped at 0, the steps of the lesson known. */
async function freshB1(page: Page): Promise<void> {
  await openApp(page);
  await page.evaluate(() => window.__app?.clock.set(0));
  await expect(page.getByTestId('step-row-5')).toBeVisible();
  await run(page, 'player.goto', { step: 1 });
}

async function centreX(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`${selector} is not drawn`);
  return box.x + box.width / 2;
}

test.describe('S1: the lesson goes step by step', () => {
  test('three steps reach step 4 at «База»; back gives exactly the state of step 3', async ({
    page,
  }) => {
    await freshB1(page);
    expect(await player(page)).toMatchObject({ step: 1, defence: false, playing: false });

    await run(page, 'player.step');
    await run(page, 'player.step');
    const third = await dump(page);
    await run(page, 'player.step');

    expect(await player(page)).toMatchObject({ step: 4, defence: false });
    await expect(page.getByTestId('step-row-4')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('player-status')).toContainText('Шаг 4 из 5');
    // The clock is stopped: step 4 (База → сервер) has its message at the database.
    const message = page.getByTestId('message');
    await expect(message).toHaveAttribute('data-step', 'answer');
    await expect(message).toHaveAttribute('data-from', 'db');
    await expect(message).toHaveAttribute('data-progress', '0');
    const db = await centreX(page, '[data-testid="participant-db"] [data-part="icon"]');
    const server = await centreX(page, '[data-testid="participant-server"] [data-part="icon"]');
    const plaque = await centreX(page, '[data-testid="message-plaque"] .plaque');
    expect(Math.abs(plaque - db)).toBeLessThan(Math.abs(plaque - server));

    await run(page, 'player.back');
    expect(await dump(page)).toBe(third);
    await expect(page.getByTestId('step-row-3')).toHaveAttribute('aria-current', 'step');
  });

  // Found in the M1.3 screenshots: opening the open lesson again lost its table.
  test('opening the open lesson again keeps its table and starts at step 1', async ({ page }) => {
    await freshB1(page);
    await run(page, 'player.goto', { step: 4 });
    await run(page, 'lesson.open', { id: 'B1' });
    await expect(page.getByTestId('step-row-5')).toBeVisible();
    await expect(page.getByTestId('player-status')).toContainText('Шаг 1 из 5');
  });

  // The event feed is task M1.5: this part of S1 waits for it.
  test.fixme('the event feed has four lines after three steps (M1.5)', async ({ page }) => {
    await freshB1(page);
    for (let i = 0; i < 3; i += 1) await run(page, 'player.step');
    await expect(page.getByTestId('feed').getByRole('listitem')).toHaveCount(4);
  });
});

test.describe('the player by its buttons', () => {
  test('every button runs its command, and the table rows go to a step', async ({ page }) => {
    await freshB1(page);
    await page.getByTestId('player-next').click();
    await page.getByTestId('player-next').click();
    expect(await player(page)).toMatchObject({ step: 3 });
    await page.getByTestId('player-back').click();
    expect(await player(page)).toMatchObject({ step: 2 });
    await page.getByTestId('step-goto-5').click();
    expect(await player(page)).toMatchObject({ step: 5 });
    await expect(page.getByTestId('player-next')).toHaveAttribute('aria-disabled', 'true');
    // At the end «Шаг» does nothing and keeps the focus (Playwright does not click a control
    // marked aria-disabled, so it is pressed from the keyboard).
    await page.getByTestId('player-next').press('Enter');
    expect(await player(page)).toMatchObject({ step: 5 });
    await expect(page.getByTestId('player-next')).toBeFocused();
    await page.getByTestId('player-restart').click();
    expect(await player(page)).toMatchObject({ step: 1 });
    await expect(page.getByTestId('player-back')).toHaveAttribute('aria-disabled', 'true');

    for (const speed of [2, 0.5, 1]) {
      await page.getByTestId('player-speed').click();
      expect(await player(page)).toMatchObject({ speed });
    }
    await expect(page.getByTestId('player-speed')).toHaveText('1×');

    await page.getByTestId('player-play').click();
    expect(await player(page)).toMatchObject({ playing: true });
    await expect(page.getByTestId('player-play')).toHaveText('Пауза');
    await page.getByTestId('player-play').click();
    expect(await player(page)).toMatchObject({ playing: false });
    await expect(page.getByTestId('player-play')).toHaveText('Пуск');
  });

  test('autoplay follows the player clock and stops on the last step', async ({ page }) => {
    await freshB1(page);
    await run(page, 'player.play');
    await page.evaluate((ms) => window.__app?.clock.tick(ms), STEP_MS - 10);
    expect(await player(page)).toMatchObject({ step: 1, playing: true });
    await page.evaluate(() => window.__app?.clock.tick(10));
    expect(await player(page)).toMatchObject({ step: 2, playing: true });
    await expect(page.getByTestId('step-row-2')).toHaveAttribute('aria-current', 'step');
    // Faster: the remaining steps at speed 2.
    await run(page, 'player.speed', { value: 2 });
    for (let i = 0; i < 4; i += 1) {
      await page.evaluate((ms) => window.__app?.clock.tick(ms), STEP_MS / 2);
    }
    expect(await player(page)).toMatchObject({ step: 5, playing: false, speed: 2 });
    await expect(page.getByTestId('player-play')).toHaveText('Пуск');
  });

  test('the site clock runs while the player plays and stops after the lesson', async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId('step-row-5')).toBeVisible();
    await run(page, 'player.speed', { value: 2 });
    await run(page, 'player.play');
    // Real time drives autoplay: B1 plays to its end on its own (4 steps of 1.2 s and a travel).
    await page.waitForFunction(() => window.__app?.state.get().player.playing === false, null, {
      timeout: 15_000,
    });
    expect(await player(page)).toMatchObject({ step: 5 });
    // Nothing to animate: the driver let go of the clock.
    const stopped = await page.evaluate(() => window.__app?.state.get().clock.timeMs);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__app?.state.get().clock.timeMs)).toBe(stopped);
  });
});

test.describe('S6: the keyboard', () => {
  test('Space, →, ←, D run play/pause, step, back, defence; focus stays visible', async ({
    page,
  }) => {
    await freshB1(page);
    // Focus on the page itself.
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('Space');
    expect(await player(page)).toMatchObject({ playing: true });
    await page.keyboard.press('Space');
    expect(await player(page)).toMatchObject({ playing: false });
    await page.keyboard.press('ArrowRight');
    expect(await player(page)).toMatchObject({ step: 2 });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    expect(await player(page)).toMatchObject({ step: 2 });
    await page.keyboard.press('d');
    expect(await player(page)).toMatchObject({ step: 2, defence: true });
    await expect(page.getByTestId('steps-table')).toHaveAttribute('data-defence', 'true');
    await page.keyboard.press('d');
    expect(await player(page)).toMatchObject({ defence: false });
    // The page did not scroll on Space and the arrows.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('from a focused button the keys still work and its focus ring stays', async ({ page }) => {
    await freshB1(page);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveCount(1);
    const id = await focused.getAttribute('data-testid');
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'd', 'd']) {
      await page.keyboard.press(key);
      await expect(page.getByTestId(id ?? '')).toBeFocused();
      const ring = await page
        .getByTestId(id ?? '')
        .evaluate(
          (el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth,
        );
      expect(ring, `focus ring after ${key}`).toBe('solid 3px');
    }
    expect(await player(page)).toMatchObject({ step: 2, defence: false });
  });

  test('every control of the player shows the focus ring when tabbed to', async ({ page }) => {
    await freshB1(page);
    const ids = ['player-back', 'player-play', 'player-next', 'player-restart', 'player-speed'];
    const seen = new Set<string>();
    for (let i = 0; i < 20 && seen.size < ids.length; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement)) return null;
        const s = getComputedStyle(el);
        return { id: el.dataset['testid'] ?? '', ring: `${s.outlineStyle} ${s.outlineWidth}` };
      });
      if (info === null || !ids.includes(info.id)) continue;
      expect(info.ring, info.id).toBe('solid 3px');
      seen.add(info.id);
    }
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  test('keys are ignored with Ctrl or ⌘ and while typing in a field', async ({ page }) => {
    await freshB1(page);
    await page.keyboard.press('Control+ArrowRight');
    await page.keyboard.press('Meta+d');
    expect(await player(page)).toMatchObject({ step: 1, defence: false });
    // A text field appears with the glossary search (M2); one made here stands in for it.
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'search';
      input.dataset['testid'] = 'probe';
      document.body.append(input);
      input.focus();
    });
    await page.keyboard.type(' d');
    await page.keyboard.press('ArrowRight');
    expect(await player(page)).toMatchObject({ step: 1, defence: false, playing: false });
    await expect(page.getByTestId('probe')).toHaveValue(' d');
  });
});

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-360', width: 360, height: 800 },
] as const) {
  test.describe(`layout at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('regions in order, no sideways scroll, controls at least 44 px', async ({
      page,
    }, testInfo) => {
      await freshB1(page);
      const box = async (id: string) => {
        const b = await page.getByTestId(id).boundingBox();
        if (b === null) throw new Error(`${id} is not drawn`);
        return b;
      };
      const [top, scene, controls, explain, log] = await Promise.all(
        ['topbar', 'scene', 'player', 'explain', 'log'].map(box),
      );
      if (!top || !scene || !controls || !explain || !log) throw new Error('missing region');
      expect(scene.y).toBeGreaterThanOrEqual(top.y + top.height);
      if (viewport.name === 'desktop') {
        // K7: scene on the left, explanation on the right, controls and table across the bottom.
        expect(explain.x).toBeGreaterThanOrEqual(scene.x + scene.width);
        expect(Math.abs(explain.y - scene.y)).toBeLessThan(2);
        expect(controls.y).toBeGreaterThanOrEqual(Math.max(scene.y + scene.height, explain.y));
        expect(log.y).toBeGreaterThan(controls.y);
        expect(log.width).toBeGreaterThan(viewport.width * 0.9);
      } else {
        // S10: scene, controls, explanation, table, one column.
        expect(controls.y).toBeGreaterThanOrEqual(scene.y + scene.height);
        expect(explain.y).toBeGreaterThanOrEqual(controls.y + controls.height);
        expect(log.y).toBeGreaterThanOrEqual(explain.y + explain.height);
        for (const b of [scene, controls, explain, log]) {
          expect(b.width).toBeGreaterThan(viewport.width * 0.85);
        }
      }
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(scroll).toBe(true);
      const buttons = await page
        .locator('[data-testid="player"] button, [data-testid="steps-table"] button')
        .evaluateAll((list) =>
          list.map((b) => {
            const r = b.getBoundingClientRect();
            return {
              id: b.getAttribute('data-testid'),
              w: r.width,
              h: r.height,
              // The label fits: nothing of «Пуск» or «Пауза» is cut off.
              fits: b.scrollWidth <= b.clientWidth,
            };
          }),
        );
      expect(buttons.length).toBe(10);
      for (const b of buttons) {
        expect(b.w, b.id ?? '').toBeGreaterThanOrEqual(44);
        expect(b.h, b.id ?? '').toBeGreaterThanOrEqual(44);
        expect(b.fits, b.id ?? '').toBe(true);
      }

      // B1 step 3: playing (mid-travel) and paused, for a look (PLAYER_SHOTS).
      await run(page, 'player.goto', { step: 3 });
      await run(page, 'player.play');
      await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS / 2);
      await sceneReady(page);
      const play = page.getByTestId('player-play');
      await expect(play).toHaveText('Пауза');
      expect(await play.evaluate((b) => b.scrollWidth <= b.clientWidth)).toBe(true);
      await keep(page, testInfo, `B1-step3-playing-${viewport.name}`);
      await run(page, 'player.pause');
      await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS);
      await sceneReady(page);
      await keep(page, testInfo, `B1-step3-paused-${viewport.name}`);
    });
  });
}
