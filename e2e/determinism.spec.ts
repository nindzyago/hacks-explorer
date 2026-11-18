// Acceptance for M0.4, browser half (oracle level A): the same scenario run twice gives an
// identical state dump and an identical screenshot, byte for byte.
import { stableDump } from '../src/core/dump';
import { expect, openApp, sceneReady, test } from './support';
import type { Page } from '@playwright/test';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;

async function clockOf(page: Page) {
  return page.evaluate(() => window.__app?.state.get().clock);
}

/** One fixed scenario through the control channel; returns what it left behind. */
async function runScenario(page: Page) {
  await openApp(page);
  const results = await page.evaluate(() => {
    const app = window.__app;
    if (app === undefined) return [];
    return [
      app.clock.tick(40),
      app.clock.set(1234),
      app.clock.tick(60),
      app.commands.run('theme.set', { theme: 'dark' }),
      app.clock.tick(Number.NaN),
      app.commands.run('clock.tick', { ms: 250 }),
    ].map((result) => (result.ok ? 'ok' : result.error.code));
  });
  expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'invalid-params', 'ok']);
  // 1234 + 60 + 250 = 1544: 154 whole steps of 10 ms and 4 ms kept.
  await expect(page.getByTestId('clock-readout')).toHaveText('Часы плеера: 1540 мс');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const dumped = stableDump(await page.evaluate(() => window.__app?.state.get()));
  if (!dumped.ok) throw new Error(dumped.error.message);
  await sceneReady(page);
  return { dump: dumped.text, png: await page.screenshot(SHOT) };
}

test('the same scenario twice gives the same dump and the same screenshot', async ({ page }) => {
  const first = await runScenario(page);
  // openApp loads the page again: a second, fresh run of the same scenario.
  const second = await runScenario(page);

  expect(second.dump).toBe(first.dump);
  expect(first.dump).toBe(
    [
      '{',
      '  "clock": {',
      '    "pendingMs": 4,',
      '    "stepMs": 10,',
      '    "timeMs": 1540',
      '  },',
      '  "theme": "dark"',
      '}',
    ].join('\n'),
  );
  expect(second.png.equals(first.png), 'screenshots of the two runs are byte-equal').toBe(true);

  // The comparison means something: clock time is on the screen, so other time is another PNG.
  await page.evaluate(() => window.__app?.clock.tick(10));
  await expect(page.getByTestId('clock-readout')).toHaveText('Часы плеера: 1550 мс');
  expect((await page.screenshot(SHOT)).equals(first.png)).toBe(false);
});

test('the site has a live clock until the first manual move stops it', async ({ page }) => {
  await openApp(page);
  // Real time drives the clock: it passes one second of its own time.
  await page.waitForFunction(() => (window.__app?.state.get().clock.timeMs ?? 0) >= 1000);

  expect(await page.evaluate(() => window.__app?.clock.tick(40))).toEqual({ ok: true });
  const stopped = await clockOf(page);
  await page.waitForTimeout(400);
  expect(await clockOf(page)).toEqual(stopped);
  await expect(page.getByTestId('clock-readout')).toHaveText(
    `Часы плеера: ${String(stopped?.timeMs)} мс`,
  );
});

test('a rejected clock call does not stop the live clock', async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => window.__app?.clock.tick(-1))).toMatchObject({ ok: false });
  const before = (await clockOf(page))?.timeMs ?? 0;
  await page.waitForFunction(
    (from) => (window.__app?.state.get().clock.timeMs ?? 0) > from,
    before,
  );
});
