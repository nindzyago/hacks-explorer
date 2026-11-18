// M1.2b acceptance (design M1.2 §8; oracle A for the screenshots, D for S2 and S11): the
// message of the current step moves by the player clock, through the temporary commands
// `scene.step` and `scene.defence` (E10). B1 step 3 stands at the middle of its path in the
// middle of the step; two runs give byte-equal screenshots; with the defence step 3's harmful plaque
// stays at the participant that stopped it, with a shield and «остановлено»; with reduced motion
// the message is at its target at once (S11). I1 shows an icon token and a step that stays put.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
] as const;
const TRAVEL_MS = 900;

/** Runs commands through the control channel; every one must be accepted. */
async function run(page: Page, ...calls: (readonly [string, unknown])[]): Promise<void> {
  const results = await page.evaluate(
    (list) => list.map(([id, params]) => window.__app?.commands.run(id, params)),
    calls,
  );
  expect(results).toEqual(calls.map(() => ({ ok: true })));
}

async function centreX(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`${selector} is not drawn`);
  return box.x + box.width / 2;
}

const plaque = '[data-testid="message-plaque"] .plaque';
const icon = (id: string) => `[data-testid="participant-${id}"] [data-part="icon"]`;

/**
 * The plaque rests at participant `id` (M1.2c, no slack): centred over its icon when it and its
 * 3 px shadow fit inside the ring with room to spare at both sides, else over the icon's centre.
 */
async function restsAt(page: Page, id: string): Promise<void> {
  const box = await page.locator(plaque).boundingBox();
  const ring = await page.getByTestId('message-ring').boundingBox();
  if (box === null || ring === null) throw new Error('no plaque or ring');
  const centre = await centreX(page, icon(id));
  if (box.width + 6 <= ring.width) {
    expect(Math.abs(box.x + box.width / 2 - centre)).toBeLessThan(1);
  } else {
    expect(box.x).toBeLessThanOrEqual(centre);
    expect(box.x + box.width).toBeGreaterThanOrEqual(centre);
  }
}

/** Every box of `selectors` lies inside the frame of zone `zone`, with no slack. */
async function inZone(page: Page, zone: string, selectors: readonly string[]): Promise<void> {
  const frame = await page.getByTestId(`zone-${zone}`).locator('[data-part="frame"]').boundingBox();
  if (frame === null) throw new Error(`no zone ${zone}`);
  for (const selector of selectors) {
    const box = await page.locator(selector).boundingBox();
    if (box === null) throw new Error(`${selector} is not drawn`);
    expect(box.x, selector).toBeGreaterThanOrEqual(frame.x);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(frame.x + frame.width);
  }
}

/** Keeps a screenshot for a human look when SCENE_SHOTS names a folder. */
async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['SCENE_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('B1 step 3: the message is at the middle of its path in the middle of the step', async ({
      page,
    }, testInfo) => {
      const shoot = async () => {
        await openApp(page);
        await page.evaluate(() => window.__app?.clock.set(0));
        await run(page, ['scene.step', { step: 3 }]);
        await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS / 2);
        const message = page.getByTestId('message');
        await expect(message).toHaveAttribute('data-step', 'glue');
        await expect(message).toHaveAttribute('data-progress', '0.5');
        await sceneReady(page);
        return page.getByTestId('scene').screenshot(SHOT);
      };
      const first = await shoot();
      const middle =
        ((await centreX(page, icon('server'))) + (await centreX(page, icon('db')))) / 2;
      expect(Math.abs((await centreX(page, plaque)) - middle)).toBeLessThan(1);
      await expect(page.getByTestId('message-word')).toHaveText('вредное');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'attack');
      await expect(page.getByTestId('message-trail')).toHaveCount(1);
      await expect(page.getByTestId('scene-step')).toHaveText(
        'Шаг 3 из 5. Сервер склеивает запрос: Веб-сервер → База данных, вредное сообщение «SELECT ...».',
      );
      await keep(page, testInfo, `m12b-b1-step3-attack-${viewport.name}`);

      // A second, fresh run of the same scenario gives the same picture byte for byte.
      const second = await shoot();
      expect(second.equals(first), 'scene screenshots of two runs are byte-equal').toBe(true);
      // And another moment is another picture.
      await page.evaluate(() => window.__app?.clock.tick(100));
      expect((await page.getByTestId('scene').screenshot(SHOT)).equals(first)).toBe(false);
    });

    test('with the defence the stopped plaque stays at the participant that stopped it (S2)', async ({
      page,
    }, testInfo) => {
      await openApp(page);
      await page.evaluate(() => window.__app?.clock.set(0));
      await run(page, ['scene.defence', { on: true }], ['scene.step', { step: 3 }]);
      // B1 step 3 with the defence: the harmful input travels to the database as a parameter.
      // On its way it is a harmful message like any other, without a shield…
      await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS / 2);
      const message = page.getByTestId('message');
      await expect(message).toHaveAttribute('data-step', 'param');
      await expect(message).toHaveAttribute('data-kind', 'attack');
      await expect(message).toHaveAttribute('data-stopped', 'false');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'attack');
      // …and at the database, the defender, it gets the shield and «остановлено» and stays.
      await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS);
      await expect(message).toHaveAttribute('data-stopped', 'true');
      await expect(page.getByTestId('message-word')).toHaveText('остановлено');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'stopped');
      const stoppedAt = await centreX(page, plaque);
      await restsAt(page, 'db');
      // The plaque and its word rest inside the database's zone, off the neighbour frames.
      await inZone(page, 'site', [
        '[data-testid="message-plaque"]',
        '[data-testid="message-word"]',
      ]);
      await expect(page.getByTestId('scene-step')).toHaveText(
        'Шаг 3 из 5. Запрос с параметром: Веб-сервер → База данных, вредное сообщение ' +
          "«параметр: admin' --» остановлено у участника «База данных».",
      );
      await sceneReady(page);
      await keep(page, testInfo, `m12b-b1-step3-defence-stopped-${viewport.name}`);
      // Nothing travels further down the line: much later it is in the same place.
      const before = await page.getByTestId('scene').screenshot(SHOT);
      await page.evaluate(() => window.__app?.clock.tick(10_000));
      expect(await centreX(page, plaque)).toBe(stoppedAt);
      expect((await page.getByTestId('scene').screenshot(SHOT)).equals(before)).toBe(true);

      // The last step is a plain refusal to the attacker: safe, no shield.
      await run(page, ['scene.step', { step: 5 }]);
      await page.evaluate(() => window.__app?.clock.tick(900));
      await expect(message).toHaveAttribute('data-step', 'refuse');
      await expect(message).toHaveAttribute('data-kind', 'safe');
      await expect(message).toHaveAttribute('data-stopped', 'false');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'safe');
      await sceneReady(page);
      await keep(page, testInfo, `m12b-b1-step5-defence-refuse-${viewport.name}`);
    });

    test('I1: an icon step is a round token; a step to oneself does not move', async ({
      page,
    }, testInfo) => {
      await openApp(page);
      await page.evaluate(() => window.__app?.clock.set(0));
      await run(page, ['lesson.open', { id: 'I1' }]);
      await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
      await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS / 2);
      const token = page.getByTestId('message-token');
      await expect(token).toHaveAttribute('data-icon', 'mail');
      await expect(token.locator('image')).toHaveAttribute('href', /^\/assets\/mail-.+\.webp$/);
      await expect(page.getByTestId('message-plaque')).toHaveCount(0);
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'attack');
      await sceneReady(page);
      await keep(page, testInfo, `m12b-i1-step1-mail-${viewport.name}`);

      // The password manager step: from the employee to the employee.
      await run(page, ['scene.defence', { on: true }]);
      const message = page.getByTestId('message');
      for (let step = 1; step <= 6; step += 1) {
        await run(page, ['scene.step', { step }]);
        if ((await message.getAttribute('data-step')) === 'autofill') break;
      }
      await expect(message).toHaveAttribute('data-step', 'autofill');
      await expect(message).toHaveAttribute('data-progress', '1');
      await expect(page.getByTestId('message-trail')).toHaveCount(0);
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'stopped');
      await restsAt(page, 'user');
      await inZone(page, 'office', [
        '[data-testid="message-plaque"]',
        '[data-testid="message-word"]',
      ]);
      await expect(page.getByTestId('scene-step')).toHaveText(
        'Шаг 3 из 5. Менеджер паролей молчит: у участника «Сотрудник», безопасное сообщение ' +
          '«пароль не подставлен» остановлено.',
      );
      await sceneReady(page);
      await keep(page, testInfo, `m12b-i1-step3-defence-autofill-${viewport.name}`);

      // The stolen password reaches the bank and stops there: the second factor (D3 a).
      await run(page, ['scene.step', { step: 4 }]);
      await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS);
      await expect(message).toHaveAttribute('data-step', 'leak');
      await expect(message).toHaveAttribute('data-kind', 'attack');
      await expect(message).toHaveAttribute('data-stopped', 'true');
      await expect(page.getByTestId('message-word')).toHaveText('остановлено');
      await restsAt(page, 'bank');
      await inZone(page, 'bank-site', [
        '[data-testid="message-plaque"]',
        '[data-testid="message-word"]',
      ]);
      await expect(page.getByTestId('scene-step')).toHaveText(
        'Шаг 4 из 5. Пароль утёк в другом месте: Атакующий → Банк, вредное сообщение ' +
          '«чужой пароль» остановлено у участника «Банк».',
      );
      await sceneReady(page);
      await keep(page, testInfo, `m12b-i1-step4-defence-stopped-${viewport.name}`);
      // The bank's answer is a plain safe reply, no shield.
      await run(page, ['scene.step', { step: 5 }]);
      await page.evaluate((ms) => window.__app?.clock.tick(ms), TRAVEL_MS);
      await expect(message).toHaveAttribute('data-step', 'second');
      await expect(message).toHaveAttribute('data-stopped', 'false');
      await expect(page.getByTestId('message-sign')).toHaveAttribute('data-sign', 'safe');
    });
  });
}

test.describe('with reduced motion (S11)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the message is at its target at once, with no movement', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__app?.clock.set(0));
    await run(page, ['scene.step', { step: 3 }]);
    const message = page.getByTestId('message');
    await expect(message).toHaveAttribute('data-progress', '1');
    await expect(message).toHaveAttribute('data-arrived', 'true');
    const db = await centreX(page, icon('db'));
    expect(Math.abs((await centreX(page, plaque)) - db)).toBeLessThan(1);
    // The same state as without reduced motion at the end of the step.
    const state = await page.evaluate(() => window.__app?.state.get().scene);
    expect(state).toEqual({ step: 3, defence: false, startedMs: 0 });
  });
});

test('the scene commands reject hostile parameters and keep the state', async ({ page }) => {
  await openApp(page);
  const codes = await page.evaluate(() =>
    [
      window.__app?.commands.run('scene.step', { step: '3' }),
      window.__app?.commands.run('scene.step', { step: 0 }),
      window.__app?.commands.run('scene.step', { step: 1e9 }),
      window.__app?.commands.run('scene.defence', { on: 'yes' }),
      window.__app?.commands.run('lesson.open', { id: '../../etc' }),
    ].map((r) => (r?.ok === false ? r.error.code : 'ok')),
  );
  expect(codes).toEqual([
    'invalid-params',
    'invalid-params',
    'invalid-params',
    'invalid-params',
    'failed',
  ]);
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'B1');
});

test('a step number past the end shows the last step', async ({ page }) => {
  await openApp(page);
  await run(page, ['scene.step', { step: 100 }]);
  await expect(page.getByTestId('message')).toHaveAttribute('data-step', 'enter');
  await expect(page.getByTestId('scene-step')).toContainText('Шаг 5 из 5.');
});

test('a token whose icon fails to download keeps its ring, without a broken image', async ({
  page,
}) => {
  await page.route('**/assets/mail-*.webp', (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: 'not an image' }),
  );
  await openApp(page);
  await run(page, ['lesson.open', { id: 'I1' }]);
  const token = page.getByTestId('message-token');
  await expect(token).toHaveAttribute('data-icon', 'mail');
  await expect(token.locator('image')).toHaveCount(0);
  await expect(token.locator('.token-ring')).toHaveCount(1);
});
