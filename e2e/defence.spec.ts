// M1.5 acceptance (oracle D): scenario S2 «Защита меняет исход» literally, the «Без защиты /
// С защитой» toggle and the event feed (K75), on a laptop and on a phone. Screenshots go to
// DEFENCE_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const TRAVEL_MS = 900;
const STEP_MS = 900 + 1500;

async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await sceneReady(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['DEFENCE_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function tick(page: Page, ms: number): Promise<void> {
  const result = await page.evaluate((t) => window.__app?.clock.tick(t), ms);
  expect(result).toEqual({ ok: true });
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

/** The value of a colour token as the browser computes it (`rgb(…)`). */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

const feedLines = (page: Page) => page.getByTestId('feed').getByRole('listitem');

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
] as const) {
  test.describe(`S2 at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('with the defence the harmful step is «остановлено»; a second toggle goes back', async ({
      page,
    }, testInfo) => {
      await freshB1(page);
      await run(page, 'defence.toggle');
      expect(await player(page)).toMatchObject({ step: 1, defence: true, playing: false });
      await run(page, 'player.play');

      // Step 3 of the defence course: the harmful input goes to the database as a parameter…
      await tick(page, 2 * STEP_MS);
      expect(await player(page)).toMatchObject({ step: 3, defence: true, playing: true });
      const message = page.getByTestId('message');
      await expect(message).toHaveAttribute('data-step', 'param');
      await expect(message).toHaveAttribute('data-stopped', 'false');
      await expect(page.getByTestId('feed-line-3')).toHaveAttribute('data-mark', 'moving');
      // …drives to the defender and stays there with the shield.
      await tick(page, TRAVEL_MS);
      await expect(message).toHaveAttribute('data-stopped', 'true');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'stopped');
      await expect(page.getByTestId('message-word')).toHaveText('остановлено');
      await expect(page.getByTestId('feed-line-3')).toHaveAttribute('data-mark', 'stopped');
      await keep(page, testInfo, `m15-B1-defence-step3-${viewport.name}`);

      // Play to the end: the lesson stops by itself after the fifth message arrives.
      for (let i = 0; i < 4 && (await player(page))?.playing === true; i += 1) {
        await tick(page, STEP_MS);
      }
      expect(await player(page)).toMatchObject({ step: 5, defence: true, playing: false });

      // The table: the harmful step is marked «остановлено» with the shield, in green; the
      // database got the input only as data; the harmful query never runs in this course.
      const row = page.getByTestId('step-row-3');
      await expect(row).toHaveAttribute('data-step', 'param');
      const result = row.getByTestId('step-result');
      await expect(result).toContainText('остановлено');
      await expect(result).toContainText('ввод остался данными');
      await expect(result.getByTestId('stopped-mark')).toBeVisible();
      expect(await result.evaluate((el) => getComputedStyle(el).color)).toBe(
        await token(page, '--scene-message-stopped'),
      );
      await expect(page.locator('[data-testid="steps-table"] [data-step="glue"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="steps-table"] [data-step="answer"]')).toHaveCount(0);

      // The feed: five lines, newest last; the third one stopped.
      await expect(feedLines(page)).toHaveCount(5);
      await expect(feedLines(page).last()).toHaveAttribute('data-step', 'refuse');
      const third = page.getByTestId('feed-line-3');
      await expect(third).toContainText("Веб-сервер → База данных: параметр: admin' --");
      await expect(third).toContainText('остановлено');
      await expect(third.getByTestId('stopped-mark')).toBeVisible();
      // Verifier M1.5: the stopped mark of the feed is the defence green of the tokens.
      expect(
        await third.getByTestId('feed-mark').evaluate((el) => getComputedStyle(el).color),
      ).toBe(await token(page, '--scene-message-stopped'));
      // Verifier M1.5: the payload keeps its words together, «admin'» and «--» on one line.
      const payload = third.getByTestId('feed-payload');
      expect(await payload.evaluate((el) => el.getClientRects().length)).toBe(1);
      expect(await payload.evaluate((el) => el.textContent.replace(/\u00a0/g, ' '))).toBe(
        "параметр: admin' --",
      );
      await expect(page.getByTestId('feed-line-2')).toHaveAttribute('data-mark', 'attack');
      await expect(page.getByTestId('feed-line-5')).toHaveAttribute('data-mark', 'safe');
      await expect(page.getByTestId('defence-on')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('defence-name')).toHaveText('Защита: Параметризованный запрос');
      await keep(page, testInfo, `m15-B1-defence-step5-feed-${viewport.name}`);

      // A second toggle: the original course from the same step number.
      await run(page, 'defence.toggle');
      expect(await player(page)).toMatchObject({ step: 5, defence: false, playing: false });
      await expect(page.getByTestId('step-row-3')).toHaveAttribute('data-step', 'glue');
      await expect(page.getByTestId('step-row-5')).toHaveAttribute('aria-current', 'step');
      await expect(page.getByTestId('defence-off')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('defence-name')).toHaveCount(0);
      await expect(feedLines(page)).toHaveCount(5);
      await expect(page.getByTestId('feed-line-3')).toHaveAttribute('data-step', 'glue');
      await expect(page.getByTestId('feed-line-5')).toHaveAttribute('data-mark', 'moving');
      await tick(page, TRAVEL_MS);
      await expect(page.getByTestId('feed-line-5')).toHaveAttribute('data-mark', 'attack');
      await expect(page.locator('[data-testid="feed"] [data-testid="stopped-mark"]')).toHaveCount(
        0,
      );
      await keep(page, testInfo, `m15-B1-attack-step5-feed-${viewport.name}`);

      // The feed never makes the page scroll sideways.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
}

test.describe('the «Без защиты / С защитой» toggle', () => {
  test('its buttons set the mode, keep the step and show the defence of the lesson', async ({
    page,
  }) => {
    await freshB1(page);
    await run(page, 'player.goto', { step: 2 });
    const off = page.getByTestId('defence-off');
    const on = page.getByTestId('defence-on');
    await expect(off).toHaveText('Без защиты');
    await expect(on).toHaveText('С защитой');
    await expect(off).toHaveAttribute('aria-pressed', 'true');
    await expect(on).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('defence-name')).toHaveCount(0);

    await on.click();
    expect(await player(page)).toMatchObject({ step: 2, defence: true });
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('defence-name')).toHaveText('Защита: Параметризованный запрос');
    await expect(page.getByTestId('steps-table')).toHaveAttribute('data-defence', 'true');

    // Pressing the mode that is on changes nothing: the step does not start again.
    await tick(page, TRAVEL_MS);
    const before = await player(page);
    await on.click();
    expect(await player(page)).toEqual(before);

    await off.click();
    expect(await player(page)).toMatchObject({ step: 2, defence: false });
    await expect(off).toHaveAttribute('aria-pressed', 'true');

    // The keyboard (K69) and the command move the same toggle.
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('d');
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await run(page, 'defence.set', { on: false });
    await expect(off).toHaveAttribute('aria-pressed', 'true');

    // Enter and Space press a focused toggle button, and its focus ring shows.
    await on.focus();
    await page.keyboard.press('Enter');
    expect(await player(page)).toMatchObject({ defence: true });
    await off.focus();
    await page.keyboard.press('Space');
    expect(await player(page)).toMatchObject({ defence: false, playing: false });
    await expect(off).toBeFocused();
    expect(
      await off.evaluate(
        (el) => `${getComputedStyle(el).outlineStyle} ${getComputedStyle(el).outlineWidth}`,
      ),
    ).toBe('solid 3px');

    for (const button of [off, on]) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('the event feed', () => {
  test('one line per started step; the current one is on its way until it arrives', async ({
    page,
  }) => {
    await freshB1(page);
    await expect(feedLines(page)).toHaveCount(1);
    await expect(page.getByTestId('feed-line-1')).toHaveAttribute('data-mark', 'moving');
    await expect(page.getByTestId('feed-line-1')).toContainText('в пути');
    await tick(page, TRAVEL_MS);
    await expect(page.getByTestId('feed-line-1')).toHaveAttribute('data-mark', 'legit');
    await expect(page.getByTestId('feed-line-1')).toContainText(
      'Атакующий → Веб-сервер: GET /login',
    );

    for (let i = 0; i < 3; i += 1) await run(page, 'player.step');
    await expect(feedLines(page)).toHaveCount(4);
    await expect(feedLines(page).last()).toHaveAttribute('data-step', 'answer');
    await run(page, 'player.back');
    await expect(feedLines(page)).toHaveCount(3);
    await run(page, 'player.goto', { step: 1 });
    await expect(feedLines(page)).toHaveCount(1);

    // Red only for harmful lines; the number and the word are there for colour-blind readers.
    await run(page, 'player.goto', { step: 5 });
    await tick(page, TRAVEL_MS);
    const red = await token(page, '--scene-message-attack');
    for (const n of [1, 2, 3, 4, 5]) {
      const line = page.getByTestId(`feed-line-${String(n)}`);
      const mark = await line.getAttribute('data-mark');
      const colour = await line
        .getByTestId('feed-mark')
        .evaluate((el) => getComputedStyle(el).color);
      expect(colour === red, `line ${String(n)} (${mark ?? ''})`).toBe(mark === 'attack');
      await expect(line.getByTestId('feed-number')).toHaveText(String(n));
    }
  });

  test.describe('with reduced motion (S11)', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the current line has arrived at once', async ({ page }) => {
      await freshB1(page);
      await run(page, 'player.step');
      await expect(page.getByTestId('feed-line-2')).toHaveAttribute('data-mark', 'attack');
    });
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('the feed is under the table, readable, without sideways scroll', async ({ page }) => {
      await freshB1(page);
      await run(page, 'defence.set', { on: true });
      await run(page, 'player.goto', { step: 5 });
      await tick(page, TRAVEL_MS);
      const table = await page.getByTestId('steps-table').boundingBox();
      const feed = await page.getByTestId('feed').boundingBox();
      if (table === null || feed === null) throw new Error('table or feed not drawn');
      expect(feed.y).toBeGreaterThanOrEqual(table.y + table.height);
      expect(feed.width).toBeGreaterThan(360 * 0.8);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const sizes = await page
        .getByTestId('feed')
        .locator('*')
        .evaluateAll((list) =>
          list
            .filter((el) => el.textContent.trim() !== '' && el.children.length === 0)
            .map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
        );
      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
      // No line overflows its box.
      const overflow = await feedLines(page).evaluateAll(
        (list) => list.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      );
      expect(overflow).toBe(0);
    });
  });
});

// Verifier M1.5: the caption «Защита: …» appeared inside the bar and moved the buttons (250 px
// at 1280, a new row at 1024). Every button of the bar stays where it was when the mode changes.
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const) {
  test.describe(`the controls bar at ${String(viewport.width)} px`, () => {
    test.use({ viewport });

    test('does not move when the defence is turned on and off', async ({ page }) => {
      await freshB1(page);
      const boxes = () =>
        page
          .locator('[data-testid="player"] button, [data-testid="defence-toggle"] button')
          .evaluateAll((list) =>
            list.map((b) => {
              const r = b.getBoundingClientRect();
              return { id: b.getAttribute('data-testid'), x: r.x, y: r.y, w: r.width, h: r.height };
            }),
          );
      const off = await boxes();
      expect(off).toHaveLength(7);
      for (const on of [true, false, true]) {
        await run(page, 'defence.set', { on });
        await expect(page.getByTestId('defence-on')).toHaveAttribute('aria-pressed', String(on));
        const now = await boxes();
        expect(now.map((b) => b.id)).toEqual(off.map((b) => b.id));
        now.forEach((b, i) => {
          const was = off[i];
          if (was === undefined) throw new Error('lost a button');
          for (const k of ['x', 'y', 'w', 'h'] as const) {
            expect(
              Math.abs(b[k] - was[k]),
              `${b.id ?? ''} ${k} with defence ${String(on)}`,
            ).toBeLessThanOrEqual(1);
          }
        });
      }
      // The caption is all there: not cut, the whole name in the text.
      const name = page.getByTestId('defence-name');
      await expect(name).toHaveText('Защита: Параметризованный запрос');
      expect(await name.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    });
  });
}

// Verifier M1.5: I1's stopped autofill step says «остановлено» in its result already; the table
// does not say it twice.
test('a stopped result that says «остановлено» is not prefixed again (I1)', async ({ page }) => {
  await openApp(page);
  await run(page, 'lesson.open', { id: 'I1' });
  await run(page, 'defence.set', { on: true });
  const row = page.locator('[data-testid="steps-table"] tr[data-step="autofill"]');
  await expect(row).toHaveCount(1);
  const result = row.getByTestId('step-result');
  await expect(result.getByTestId('stopped-mark')).toBeVisible();
  expect((await result.textContent())?.trim()).toBe('остановлено');
  // The other stopped step of I1 keeps the prefix before its own result.
  const leak = page
    .locator('[data-testid="steps-table"] tr[data-step="leak"]')
    .getByTestId('step-result');
  expect((await leak.textContent())?.trim()).toBe('остановлено: пароль верный, но вход не открыт');
});
