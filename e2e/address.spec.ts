// M2.2 acceptance (oracle D): scenario S4 «Ссылка открывает то же место» literally, plus the
// address following the player, reload, back and forward, and bad addresses (L0.1, L0.2).
import type { Page } from '@playwright/test';
import { expect, openApp, test } from './support';

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function place(page: Page) {
  return page.evaluate(() => {
    const state = window.__app?.state.get();
    return state === undefined
      ? null
      : { lesson: state.lesson, step: state.player.step, defence: state.player.defence };
  });
}

const path = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.hash}`;
};

/** What the reader sees: the step of the player and the mode of the toggle. */
async function shows(page: Page, step: string, defence: boolean): Promise<void> {
  await expect(page.getByTestId('player-status')).toHaveText(step);
  await expect(page.getByTestId('defence-toggle')).toHaveAttribute('data-defence', String(defence));
}

test('S4: B1, step 3, defence on; the copied address opens the same place in a new tab', async ({
  page,
  context,
}) => {
  // Given lesson B1, step 3, defence on — reached with the interface, not the address.
  await openApp(page);
  await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
  await page.getByTestId('defence-on').click();
  await page.getByTestId('player-next').click();
  await page.getByTestId('player-next').click();
  await shows(page, 'Шаг 3 из 5', true);
  // When the address is copied and opened in a new tab
  const copied = page.url();
  expect(path(page)).toBe('/ru/lesson/B1#step-3-defence');
  const tab = await context.newPage();
  await openApp(tab, copied);
  // Then B1, step 3, defence on, the same language.
  expect(await place(tab)).toEqual({ lesson: 'B1', step: 3, defence: true });
  await shows(tab, 'Шаг 3 из 5', true);
  await expect(tab.getByTestId('lesson-title')).toHaveText(
    (await page.getByTestId('lesson-title').textContent()) ?? '',
  );
  await expect(tab.locator('html')).toHaveAttribute('lang', 'ru');
  expect(path(tab)).toBe('/ru/lesson/B1#step-3-defence');
  await tab.close();
});

test('a step change updates the address; a reload keeps the place', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1#step-3-defence');
  await shows(page, 'Шаг 3 из 5', true);
  // The tab's first entry is about:blank; the lesson adds one.
  const entries = await page.evaluate(() => history.length);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#step-4-defence$/);
  await page.keyboard.press('d');
  await expect(page).toHaveURL(/#step-4$/);
  await run(page, 'player.goto', { step: 1 });
  await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
  await run(page, 'player.goto', { step: 2 });
  // No history entry per step: one entry for the lesson.
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await page.reload();
  await page.waitForFunction(() => window.__app !== undefined);
  await shows(page, 'Шаг 2 из 5', false);
  expect(path(page)).toBe('/ru/lesson/B1#step-2');
});

test('a step past the end of the lesson becomes its last step', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1#step-99-defence');
  await shows(page, 'Шаг 5 из 5', true);
  await expect(page).toHaveURL(/#step-5-defence$/);
});

test('back and forward move between lessons, each in its own place', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1#step-3-defence');
  await shows(page, 'Шаг 3 из 5', true);
  await run(page, 'lesson.open', { id: 'I1' });
  await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
  await expect(page.getByTestId('player-status')).toHaveText(/^Шаг 1 из \d+$/);
  await run(page, 'player.goto', { step: 2 });
  await expect(page).toHaveURL(/\/ru\/lesson\/I1#step-2$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/ru\/lesson\/B1#step-3-defence$/);
  await shows(page, 'Шаг 3 из 5', true);
  expect(await place(page)).toEqual({ lesson: 'B1', step: 3, defence: true });
  await page.goForward();
  await expect(page).toHaveURL(/\/ru\/lesson\/I1#step-2$/);
  expect(await place(page)).toEqual({ lesson: 'I1', step: 2, defence: false });
  await expect(page.getByTestId('player-status')).toHaveText(/^Шаг 2 из \d+$/);
});

test('a hash edited by hand moves the player; garbage gives step 1', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1');
  await page.evaluate(() => {
    location.hash = '#step-4-defence';
  });
  await shows(page, 'Шаг 4 из 5', true);
  await page.evaluate(() => {
    location.hash = '#<img src=x onerror=alert(1)>';
  });
  await shows(page, 'Шаг 1 из 5', false);
  await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
});

test('the home page and forgiven addresses are rewritten to the canonical address', async ({
  page,
}) => {
  for (const [from, to] of [
    ['/', '/ru/lesson/B1'],
    ['/ru', '/ru/lesson/B1'],
    ['/en/lesson/b1/#step-2', '/ru/lesson/B1#step-2'],
  ] as const) {
    await openApp(page, from);
    expect(path(page), from).toBe(to);
  }
});

test('an unknown lesson in the address is a message with «На главную»', async ({ page }) => {
  await page.goto('/ru/lesson/Z9#step-3');
  const error = page.getByTestId('lesson-error');
  await expect(error).toHaveAttribute('data-code', 'not-found');
  await expect(page.getByTestId('lesson-error-home')).toHaveText('На главную');
  await page.getByTestId('lesson-error-home').click();
  await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
  await expect(page.getByTestId('scene')).toBeVisible();
});

test('an address that is no page of the site is a message with «На главную»', async ({ page }) => {
  for (const bad of [
    '/ru/lesson/__proto__',
    '/ru/lesson/..%2FB1',
    '/ru/lesson/B1/extra',
    `/ru/lesson/${'B1'.repeat(400)}`,
    '/%D1%83%D1%80%D0%BE%D0%BA',
  ]) {
    await page.goto(bad);
    await expect(page.getByTestId('page-not-found'), bad).toBeVisible();
    await expect(page.getByTestId('page-not-found')).toContainText('Такой страницы нет');
    await expect(page.getByTestId('scene')).toHaveCount(0);
    // The address is left as the reader typed it.
    expect(new URL(page.url()).pathname, bad).toBe(bad);
    // Keys do nothing on this page.
    await page.waitForFunction(() => window.__app !== undefined);
    await page.keyboard.press('d');
    expect(new URL(page.url()).hash).toBe('');
  }
  await page.getByTestId('not-found-home').click();
  await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
  await expect(page.getByTestId('scene')).toBeVisible();
});
