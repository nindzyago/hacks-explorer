// Acceptance for M0.3 (oracle level D, architecture §4): a test opens the site without a
// window, runs a command through `window.__app`, reads the state and gets a PNG.
import { readFileSync } from 'node:fs';
import { expect, openApp, pngSize, test } from './support';

test('runs a command, reads the state and takes a PNG', async ({ page }, testInfo) => {
  await openApp(page);

  const commands = await page.evaluate(() => window.__app?.commands.list());
  expect(commands).toContainEqual({
    id: 'theme.set',
    titleKey: 'command.theme.set',
    params: { theme: { kind: 'enum', values: ['light', 'dark'] } },
    enabled: true,
  });
  expect(await page.evaluate(() => window.__app?.state.get())).toMatchObject({ theme: 'light' });
  const light = await page.screenshot();

  const result = await page.evaluate(() =>
    window.__app?.commands.run('theme.set', { theme: 'dark' }),
  );
  expect(result).toEqual({ ok: true });
  expect(await page.evaluate(() => window.__app?.state.get())).toMatchObject({ theme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const path = testInfo.outputPath('theme-dark.png');
  await page.screenshot({ path });
  const dark = readFileSync(path);
  expect(pngSize(dark)).toEqual({ width: 1280, height: 720 });
  expect(dark.length).toBeGreaterThan(2000);
  expect(dark.equals(light), 'the command changed what is on the screen').toBe(false);
  await testInfo.attach('theme-dark', { path, contentType: 'image/png' });
});

test('the button and the channel run the same command', async ({ page }) => {
  await openApp(page);
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__app?.state.get())).toMatchObject({ theme: 'dark' });

  await page.evaluate(() => window.__app?.commands.run('theme.set', { theme: 'light' }));
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('hostile calls get an error as data and change nothing', async ({ page }) => {
  await openApp(page);
  const results = await page.evaluate(() => {
    const app = window.__app;
    if (app === undefined) return [];
    const run = (id: unknown, params?: unknown) => app.commands.run(id, params);
    const throwing = {
      get theme(): string {
        throw new Error('boom');
      },
    };
    return [
      run(undefined),
      run(42, {}),
      run('no.such', {}),
      run('x'.repeat(100_000), {}),
      run('theme.set'),
      run('theme.set', { theme: 'blue' }),
      run('theme.set', { theme: 'dark', extra: 1 }),
      run('theme.set', 'dark'),
      run('theme.set', throwing),
      run('theme.set', document.body),
    ];
  });
  expect(results.map((result) => (result.ok ? 'ok' : result.error.code))).toEqual([
    'unknown-command',
    'unknown-command',
    'unknown-command',
    'unknown-command',
    'invalid-params',
    'invalid-params',
    'invalid-params',
    'invalid-params',
    'invalid-params',
    'invalid-params',
  ]);
  expect(await page.evaluate(() => window.__app?.state.get())).toMatchObject({ theme: 'light' });
});

test('a page script cannot replace or change the channel', async ({ page }) => {
  await openApp(page);
  const frozen = await page.evaluate(() => {
    const before = window.__app;
    try {
      Object.assign(window, { __app: null });
    } catch {
      // Assigning to a read-only property throws in a module; either way it must not change.
    }
    return window.__app === before && Object.isFrozen(before) && Object.isFrozen(before?.commands);
  });
  expect(frozen).toBe(true);
});

test('an unknown address opens the application, not an empty page', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hacks Explorer');
});

test('every interactive element has a data-testid', async ({ page }) => {
  await openApp(page);
  const unnamed = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]',
      ),
    )
      .filter((element) => !element.hasAttribute('data-testid'))
      .map((element) => element.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});
