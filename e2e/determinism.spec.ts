// Acceptance for M0.4, browser half (oracle level A): the same scenario run twice gives an
// identical state dump and an identical screenshot, byte for byte. Since M1.2b the clock is on
// the screen through the scene: the message of the current step stands where clock time says.
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
      // M1.2b: step 3 starts at 1230; at 1540 its message is on the way, so time is on screen.
      app.commands.run('player.goto', { step: 3 }),
      app.clock.tick(60),
      app.commands.run('theme.set', { theme: 'dark' }),
      app.clock.tick(Number.NaN),
      app.commands.run('clock.tick', { ms: 250 }),
    ].map((result) => (result.ok ? 'ok' : result.error.code));
  });
  expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'invalid-params', 'ok']);
  // 1234 + 60 + 250 = 1544: 154 whole steps of 10 ms and 4 ms kept. 310 ms into the step of
  // 900: eased 2·(310/900)² = 0.237 of the way.
  await expect(page.getByTestId('message')).toHaveAttribute('data-progress', '0.237');
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
      '  "depth": "simple",',
      '  "glossary": null,',
      '  "lesson": "B1",',
      '  "player": {',
      '    "counts": {',
      '      "with": 5,',
      '      "without": 5',
      '    },',
      '    "defence": false,',
      '    "playing": false,',
      '    "speed": 1,',
      '    "startedMs": 1230,',
      '    "step": 3',
      '  },',
      '  "theme": "dark"',
      '}',
    ].join('\n'),
  );
  expect(second.png.equals(first.png), 'screenshots of the two runs are byte-equal').toBe(true);

  // The comparison means something: the message moves with clock time (no readout since
  // M1.2b), so other time is another PNG.
  await page.evaluate(() => window.__app?.clock.tick(10));
  await expect(page.getByTestId('message')).not.toHaveAttribute('data-progress', '0.237');
  expect((await page.screenshot(SHOT)).equals(first.png)).toBe(false);
});

// M1.3 (K68): real time runs the clock while the player plays or a message is on its way.
test('the site has a live clock until the first manual move stops it', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.__app?.commands.run('player.play'));
  // Real time drives the clock: it passes one second of its own time.
  await page.waitForFunction(() => (window.__app?.state.get().clock.timeMs ?? 0) >= 1000);

  expect(await page.evaluate(() => window.__app?.clock.tick(40))).toEqual({ ok: true });
  const stopped = await clockOf(page);
  await page.waitForTimeout(400);
  expect(await clockOf(page)).toEqual(stopped);
  // The scene stopped with the clock: a new step does not move without manual time.
  await page.evaluate(() => window.__app?.commands.run('player.goto', { step: 2 }));
  await page.waitForTimeout(200);
  await expect(page.getByTestId('message')).toHaveAttribute('data-progress', '0');
});

test('a rejected clock call does not stop the live clock', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.__app?.commands.run('player.play'));
  expect(await page.evaluate(() => window.__app?.clock.tick(-1))).toMatchObject({ ok: false });
  const before = (await clockOf(page))?.timeMs ?? 0;
  await page.waitForFunction(
    (from) => (window.__app?.state.get().clock.timeMs ?? 0) > from,
    before,
  );
});
