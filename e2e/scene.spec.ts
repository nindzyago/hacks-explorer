// M1.2a, oracle levels D and C (design M1.2 §5): the still scene of B1 on the page, under the
// site's real CSP, with no console errors; nothing leaves the scene or overlaps at 1280 and
// 390 px, no sideways scroll, text at least 11 px; screenshots are byte-identical across
// reloads; loading and broken data show a message, an unknown icon a placeholder (L0.1).
// M1.2c: the message too — ring, plaque or token, word and trail — at both ends of every step of
// B1 and I1 in both modes, with no slack.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';
import { layoutProblems, messageProblems, sceneBoxes } from './scene-boxes';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
// M1.2d: also the narrow Android phones of 375 and 360 px.
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-360', width: 360, height: 800 },
] as const;

test('the B1 scene is on the page with its participants and zones', async ({ page }) => {
  await openApp(page);
  const scene = page.getByTestId('scene');
  await expect(scene).toBeVisible();
  for (const id of ['attacker', 'server', 'db']) {
    await expect(scene.getByTestId(`participant-${id}`)).toBeVisible();
    await expect(scene.getByTestId(`participant-${id}`).locator('image')).toHaveAttribute(
      'href',
      /^\/assets\/.+\.webp$/,
    );
  }
  for (const id of ['internet', 'site'])
    await expect(scene.getByTestId(`zone-${id}`)).toBeVisible();
  await expect(scene.getByTestId('zone-site')).toContainText('Сайт shop.example');
  await expect(scene.getByTestId('participant-server')).toContainText('Веб-сервер');
  // M2.7: a labelled group, not an image, so its term buttons stay reachable.
  const group = scene.getByRole('group', { name: 'Схема урока «SQL-инъекция»' });
  await expect(group).toBeVisible();
  await expect(group).toHaveAccessibleDescription(/^Участники слева направо: Атакующий/);
  await expect(scene.getByTestId('scene-description')).toHaveText(
    'Участники слева направо: Атакующий (203.0.113.66), Веб-сервер (198.51.100.10), ' +
      'База данных (таблица users). Зоны доверия: Интернет: Атакующий; ' +
      'Сайт shop.example: Веб-сервер, База данных.',
  );
  // No dark theme for now (K43): no theme button on the page.
  await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Тёмная тема' })).toHaveCount(0);
});

test('icons and fonts come from this site', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await openApp(page);
  await sceneReady(page);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
  expect(requests.filter((url) => url.endsWith('.webp'))).toHaveLength(3);
  expect(requests.some((url) => url.includes('/fonts/onest-cyrillic.woff2'))).toBe(true);
  expect(requests.some((url) => url.includes('/fonts/jetbrains-mono-latin.woff2'))).toBe(true);
  expect(
    await page.evaluate(() =>
      ['13px Onest', '11px "JetBrains Mono"'].map((font) => document.fonts.check(font, 'Сайт')),
    ),
  ).toEqual([true, true]);
});

for (const viewport of VIEWPORTS) {
  test.describe(`at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('nothing leaves the scene or overlaps, no sideways scroll, text ≥ 11 px', async ({
      page,
    }) => {
      await openApp(page);
      for (const lesson of [
        { id: 'B1', parts: 3 * 3 + 2 * 2 },
        { id: 'I1', parts: 4 * 3 + 4 * 2 },
      ]) {
        await page.evaluate((id) => window.__app?.commands.run('lesson.open', { id }), lesson.id);
        await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', lesson.id);
        await sceneReady(page);
        const { scene, boxes } = await sceneBoxes(page);
        expect(boxes.length).toBeGreaterThanOrEqual(lesson.parts);
        expect(scene.width).toBeLessThanOrEqual(viewport.width);
        expect(layoutProblems(scene, boxes), lesson.id).toEqual([]);
        const texts = boxes.filter((b) => b.what !== 'icon' && b.what !== 'frame');
        expect(Math.min(...texts.map((b) => b.fontSize))).toBeGreaterThanOrEqual(11);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
    });

    test('the message at rest covers nothing: every step of B1 and I1, both modes (M1.2c)', async ({
      page,
    }) => {
      await openApp(page);
      const seen: string[] = [];
      for (const lesson of ['B1', 'I1']) {
        await page.evaluate((id) => window.__app?.commands.run('lesson.open', { id }), lesson);
        await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', lesson);
        await sceneReady(page);
        for (const on of [false, true]) {
          await page.evaluate((v) => window.__app?.commands.run('defence.set', { on: v }), on);
          const count = Number(
            /из (\d+)/.exec((await page.getByTestId('scene-step').textContent()) ?? '')?.[1],
          );
          expect(count).toBeGreaterThanOrEqual(5);
          for (let step = 1; step <= count; step += 1) {
            await page.evaluate((n) => {
              window.__app?.clock.set(0);
              window.__app?.commands.run('player.goto', { step: n });
            }, step);
            for (const [ms, progress] of [
              [0, '0'],
              [900, '1'],
            ] as const) {
              await page.evaluate((t) => window.__app?.clock.set(t), ms);
              const message = page.getByTestId('message');
              // A step from a participant to itself is there at once.
              const still =
                (await message.getAttribute('data-from')) ===
                (await message.getAttribute('data-to'));
              await expect(message).toHaveAttribute('data-progress', still ? '1' : progress);
              const { scene, boxes, message: m } = await sceneBoxes(page);
              if (m === null) throw new Error('no message');
              const where = `${lesson} ${on ? 'defence' : 'attack'} step ${String(step)} at ${progress}`;
              seen.push(`${where} ${String(await message.getAttribute('data-step'))}`);
              expect(layoutProblems(scene, boxes), where).toEqual([]);
              expect(messageProblems(scene, boxes, m), where).toEqual([]);
              // Text of the message is not below 11 px either.
              expect(m.word.fontSize, where).toBeGreaterThanOrEqual(11);
              // M1.2d: and no plaque text is cut.
              const label = page.getByTestId('message-label');
              if ((await label.count()) > 0) {
                expect(await label.textContent(), where).not.toContain('…');
              }
            }
          }
        }
      }
      // Every step of both lessons in both modes, at both ends.
      expect(seen).toHaveLength(2 * 2 * 5 * 2);
      for (const id of ['glue', 'param', 'autofill', 'leak', 'bait', 'refuse']) {
        expect(seen.some((s) => s.endsWith(` ${id}`))).toBe(true);
      }
    });

    test('the message check sees a hidden ring, a hidden word and a plaque on a frame (M1.2c)', async ({
      page,
    }) => {
      await openApp(page);
      await page.evaluate(() => {
        window.__app?.clock.set(0);
        window.__app?.commands.run('player.goto', { step: 3 });
        window.__app?.clock.set(900);
      });
      await expect(page.getByTestId('message')).toHaveAttribute('data-progress', '1');
      await sceneReady(page);
      const clean = await sceneBoxes(page);
      if (clean.message === null) throw new Error('no message');
      expect(messageProblems(clean.scene, clean.boxes, clean.message)).toEqual([]);
      const broken = async (change: () => void) => {
        await page.evaluate(change);
        const { scene, boxes, message } = await sceneBoxes(page);
        if (message === null) throw new Error('no message');
        return messageProblems(scene, boxes, message);
      };
      expect(
        await broken(() =>
          document.querySelector('[data-testid="message-ring"]')?.setAttribute('display', 'none'),
        ),
      ).toContain('ring: display none');
      await page.evaluate(() =>
        document.querySelector('[data-testid="message-ring"]')?.removeAttribute('display'),
      );
      expect(
        await broken(() =>
          // Through the CSSOM: the component's class sets the opacity, beating an attribute.
          document
            .querySelector('[data-testid="message-ring"]')
            ?.parentElement?.style.setProperty('opacity', '0'),
        ),
      ).toContain('ring: opacity 0');
      await page.evaluate(() =>
        document
          .querySelector('[data-testid="message-ring"]')
          ?.parentElement?.style.removeProperty('opacity'),
      );
      expect(
        await broken(() =>
          document.querySelector('[data-testid="message-ring"]')?.setAttribute('stroke-width', '0'),
        ),
      ).toContain('ring: stroke 0px');
      await page.evaluate(() =>
        document.querySelector('[data-testid="message-ring"]')?.setAttribute('stroke-width', '2'),
      );
      expect(
        await broken(() =>
          document
            .querySelector('[data-testid="message-word"]')
            ?.setAttribute('visibility', 'hidden'),
        ),
      ).toContain('word: visibility hidden');
      await page.evaluate(() =>
        document.querySelector('[data-testid="message-word"]')?.removeAttribute('visibility'),
      );
      // M1.2d: what M1.2c did not see. Each change is made through the CSSOM (the component's
      // classes beat attributes) and undone before the next.
      const styled = async (selector: string, property: string, value: string) => {
        const found = await broken(() => undefined);
        expect(found).toEqual([]);
        await page.evaluate(
          ([s, p, v]) => {
            const e = document.querySelector(s);
            if (e instanceof SVGElement) e.style.setProperty(p, v);
          },
          [selector, property, value] as const,
        );
        const problems = await broken(() => undefined);
        await page.evaluate(
          ([s, p]) => {
            const e = document.querySelector(s);
            if (e instanceof SVGElement) e.style.removeProperty(p);
          },
          [selector, property] as const,
        );
        return problems;
      };
      const ringSel = '[data-testid="message-ring"]';
      const plaqueSel = '[data-testid="message-plaque"] .plaque';
      const labelSel = '[data-testid="message-label"]';
      const wordSel = '[data-testid="message-word"]';
      expect(await styled(ringSel, 'stroke-opacity', '0')).toContain('ring: stroke-opacity 0');
      expect(await styled(plaqueSel, 'fill-opacity', '0')).toContain('body: fill-opacity 0');
      expect(await styled(labelSel, 'display', 'none')).toContain('label: display none');
      expect(await styled(labelSel, 'fill-opacity', '0')).toContain('label: fill-opacity 0');
      // The label in the plaque's own colour, the word in the paper's: there but unreadable.
      expect(
        (await styled(labelSel, 'fill', 'var(--scene-message-attack)')).some((p) =>
          p.startsWith('label: contrast 1.0'),
        ),
      ).toBe(true);
      expect(
        (await styled(wordSel, 'fill', 'var(--scene-paper)')).some((p) =>
          p.startsWith('word: contrast 1.0'),
        ),
      ).toBe(true);
      // A ring in the paper's colour is not seen either.
      expect(
        (await styled(ringSel, 'stroke', 'var(--scene-paper)')).some((p) =>
          p.startsWith('ring: contrast'),
        ),
      ).toBe(true);
      // The plaque pushed up over the top of the ring, off the lane.
      const lifted = await styled(
        '[data-testid="message-plaque"]',
        'transform',
        'translateY(-30px)',
      );
      expect(lifted.some((p) => p.startsWith('plaque off the lane'))).toBe(true);
      // M1.2d, second round: shrunk to a dot, clipped away, dashed into gaps, text of 2 px.
      expect(
        (await styled('[data-testid="message-plaque"]', 'transform', 'scale(0.01)')).some((p) =>
          p.startsWith('body: drawn'),
        ),
      ).toBe(true);
      expect(
        (await styled(plaqueSel, 'clip-path', 'inset(50%)')).some((p) =>
          p.startsWith('body: clip-path'),
        ),
      ).toBe(true);
      expect(
        (await styled(ringSel, 'stroke-dasharray', '0 10000')).some((p) =>
          p.startsWith('ring: dashed'),
        ),
      ).toBe(true);
      expect(await styled(labelSel, 'font-size', '2px')).toContain('label: font-size 2px');
      expect(
        (await styled(wordSel, 'transform', 'scale(0.1)')).some((p) => p.startsWith('word: drawn')),
      ).toBe(true);
      // The plaque grown down over the database's icon (M1.2d: no cover at all).
      const grown = await broken(() => {
        for (const r of document.querySelectorAll('[data-testid="message-plaque"] > rect')) {
          r.setAttribute('height', String(Number(r.getAttribute('height')) + 60));
        }
      });
      expect(grown).toContain('plaque covers participant-db icon');
      await page.evaluate(() => {
        for (const r of document.querySelectorAll('[data-testid="message-plaque"] > rect')) {
          r.setAttribute('height', String(Number(r.getAttribute('height')) - 60));
        }
      });
      expect(await broken(() => undefined)).toEqual([]);

      // The ring pulled onto the database's note; the plaque moved onto the internet zone.
      const cut = await broken(() => {
        const r = document.querySelector('[data-testid="message-ring"]');
        r?.setAttribute('height', String(Number(r.getAttribute('height')) - 12));
      });
      expect(cut.some((p) => p.startsWith('ring × participant-db'))).toBe(true);
      const moved = await broken(() => {
        // Onto the right edge of the internet zone's frame, at the same height.
        const frame = document.querySelector('[data-testid="zone-internet"] [data-part="frame"]');
        const edge = Number(frame?.getAttribute('x')) + Number(frame?.getAttribute('width'));
        const g = document.querySelector('[data-testid="message-plaque"]')?.parentElement;
        const y = /translate\(\S+ (\S+)\)/.exec(g?.getAttribute('transform') ?? '')?.[1] ?? '0';
        g?.setAttribute('transform', `translate(${String(edge)} ${y})`);
      });
      expect(moved.some((p) => p.startsWith('plaque crosses zone-'))).toBe(true);
    });

    test('the overlap check sees a zone frame moved onto another zone (M1.2b)', async ({
      page,
    }) => {
      await openApp(page);
      await sceneReady(page);
      const before = await sceneBoxes(page);
      expect(layoutProblems(before.scene, before.boxes)).toEqual([]);
      // Move the frame of the internet zone to the right, onto the site zone.
      await page.evaluate(() => {
        const frame = document.querySelector('[data-testid="zone-internet"] [data-part="frame"]');
        const x = Number(frame?.getAttribute('x'));
        const width = Number(frame?.getAttribute('width'));
        frame?.setAttribute('x', String(x + width * 1.5));
      });
      const after = await sceneBoxes(page);
      const found = layoutProblems(after.scene, after.boxes);
      expect(found).toContain('zone-internet frame × zone-site frame');
      expect(found.some((p) => p.startsWith('participant-attacker') && p.includes('leaves'))).toBe(
        true,
      );
    });

    test('addresses and names do not break inside a word (M1.2b)', async ({ page }) => {
      await openApp(page);
      await page.evaluate(() => window.__app?.commands.run('lesson.open', { id: 'I1' }));
      await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
      const notes = await page
        .locator('[data-testid^="participant-"] [data-part="note"]')
        .allTextContents();
      const names = await page
        .locator('[data-testid^="participant-"] [data-part="name"]')
        .allTextContents();
      const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
      // M1.2d: an address is never cut; on a narrow phone it breaks after a dot onto the next
      // line and still reads as one word.
      expect(notes.map(squash)).toEqual([
        '203.0.113.66',
        '192.0.2.24',
        'bank-login.example',
        'bank.example',
      ]);
      const drawn = await page.locator('[data-testid="scene"] svg').textContent();
      expect(drawn ?? '').not.toContain('…');
      // Lines of one label are separate words: a space between them, never a word cut in two.
      expect(names.map(squash)).toEqual(['Атакующий', 'Сотрудник', 'Поддельная страница', 'Банк']);
    });

    test('the screenshot is the same byte for byte after a reload', async ({ page }, testInfo) => {
      const shoot = async () => {
        await openApp(page);
        await page.evaluate(() => window.__app?.clock.set(0));
        await expect(page.getByTestId('message')).toHaveAttribute('data-progress', '0');
        await sceneReady(page);
        return {
          page: await page.screenshot(SHOT),
          scene: await page.getByTestId('scene').screenshot(SHOT),
        };
      };
      const first = await shoot();
      // openApp loads the page again (a page.reload() here would be cut off by its goto).
      const second = await shoot();
      expect(second.page.equals(first.page), 'page screenshots are byte-equal').toBe(true);
      expect(second.scene.equals(first.scene), 'scene screenshots are byte-equal').toBe(true);

      const path = testInfo.outputPath(`scene-b1-${viewport.name}.png`);
      await page.screenshot({ ...SHOT, path });
      await testInfo.attach(`scene-b1-${viewport.name}`, { path, contentType: 'image/png' });
      // A copy that survives the next run, for a human look (SCENE_SHOTS=folder).
      const keep = process.env['SCENE_SHOTS'];
      if (keep !== undefined && keep !== '') {
        mkdirSync(keep, { recursive: true });
        copyFileSync(path, join(keep, `scene-b1-${viewport.name}.png`));
      }
    });
  });
}

/** Answers lesson file requests with the real file changed by `change`. */
async function changeLesson(page: Page, change: (lesson: Record<string, unknown>) => void) {
  await page.route('**/data/lessons/B1.ru.*.json', async (route: Route) => {
    const response = await route.fetch();
    const lesson = (await response.json()) as Record<string, unknown>;
    change(lesson);
    await route.fulfill({ response, body: JSON.stringify(lesson) });
  });
}

test('an icon name the site does not know gets a placeholder, not a broken image', async ({
  page,
}) => {
  await changeLesson(page, (lesson) => {
    const participants = lesson['participants'];
    if (!Array.isArray(participants)) throw new Error('no participants');
    const first: unknown = participants[0];
    if (typeof first !== 'object' || first === null) throw new Error('no participant');
    Object.assign(first, { icon: 'no-such-icon' });
  });
  await openApp(page);
  const attacker = page.getByTestId('participant-attacker');
  await expect(attacker.getByTestId('icon-placeholder')).toBeVisible();
  await expect(attacker.locator('image')).toHaveCount(0);
  await expect(page.getByTestId('participant-server').locator('image')).toHaveCount(1);
});

test('broken lesson data is a message with a way out, not an empty page', async ({ page }) => {
  await page.route('**/data/catalog.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"format": 1, "les' }),
  );
  await page.goto('/ru/lesson/B1');
  const error = page.getByTestId('lesson-error');
  await expect(error).toContainText('Не удалось открыть урок');
  // Russian for the reader (M1.2b); the loader's code stays on the element for tests.
  await expect(error).toHaveAttribute('data-code', 'bad-data');
  await expect(page.getByTestId('lesson-error-text')).toHaveText(
    'Файл урока повреждён или устарел. Попробуйте снова; если не поможет — обновите страницу.',
  );
  expect(await error.innerText()).not.toMatch(/[A-Za-z]{3,}/);
  await expect(page.getByTestId('lesson-error-home')).toHaveAttribute('href', '/');
  await expect(page.getByTestId('scene')).toHaveCount(0);
  // The data is fixed (a new deploy): «Попробовать снова» opens the lesson without a reload.
  await page.unroute('**/data/catalog.json');
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByTestId('scene')).toBeVisible();
  await expect(page.getByTestId('lesson-error')).toHaveCount(0);
});

test('a lesson that never arrives becomes a message with a retry after 15 s (M1.2b)', async ({
  page,
}) => {
  await page.clock.install();
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/data/catalog.json', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/ru/lesson/B1');
  await expect(page.getByTestId('lesson-loading')).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('lesson-loading')).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(page.getByTestId('lesson-error')).toHaveAttribute('data-code', 'timeout');
  await expect(page.getByTestId('lesson-error-text')).toHaveText(
    'Урок загружается слишком долго. Проверьте подключение и попробуйте снова.',
  );
  release();
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByTestId('scene')).toBeVisible();
});

test('an unknown lesson is a Russian message, not an empty page (M1.2b)', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.__app?.commands.run('lesson.open', { id: 'Z9' }));
  await expect(page.getByTestId('lesson-error')).toHaveAttribute('data-code', 'not-found');
  await expect(page.getByTestId('lesson-error-text')).toHaveText(
    'Такого урока нет или он ещё не переведён на этот язык.',
  );
});

test('an icon that fails to download gets the placeholder too (M1.2b)', async ({ page }) => {
  const icon = await iconPath(page, 'attacker');
  await page.route(`**${icon}`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: 'not an image' }),
  );
  await page.goto('/ru/lesson/B1');
  const attacker = page.getByTestId('participant-attacker');
  await expect(attacker.getByTestId('icon-placeholder')).toBeVisible();
  await expect(attacker.locator('image')).toHaveCount(0);
  await expect(page.getByTestId('participant-server').locator('image')).toHaveCount(1);
});

/** The path of a participant's icon in the build, read from a fresh page. */
async function iconPath(page: Page, participant: string): Promise<string> {
  await openApp(page);
  const href = await page
    .getByTestId(`participant-${participant}`)
    .locator('image')
    .getAttribute('href');
  if (href === null) throw new Error('no icon');
  return href;
}

test('while the lesson loads the page says so', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/data/catalog.json', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/ru/lesson/B1');
  await expect(page.getByTestId('lesson-loading')).toHaveText('Загружаем урок…');
  release();
  await expect(page.getByTestId('scene')).toBeVisible();
  await expect(page.getByTestId('lesson-loading')).toHaveCount(0);
});
