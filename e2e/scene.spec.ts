// M1.2a, oracle levels D and C (design M1.2 §5): the still scene of B1 on the page, under the
// site's real CSP, with no console errors; nothing leaves the scene or overlaps at 1280 and
// 390 px, no sideways scroll, text at least 11 px; screenshots are byte-identical across
// reloads; loading and broken data show a message, an unknown icon a placeholder (L0.1).
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
] as const;

interface Box {
  readonly what: string;
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  /** For the parts of a zone: owners (`participant-<id>`) of its members. */
  readonly members?: readonly string[];
}

/** The real boxes of everything drawn in the scene, as the browser lays them out. */
async function sceneBoxes(page: Page): Promise<{ scene: Box; boxes: Box[] }> {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="scene"] svg');
    if (svg === null) throw new Error('no scene');
    const box = (element: Element, what: string, owner: string) => {
      const r = element.getBoundingClientRect();
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      return { what, owner, x: r.x, y: r.y, width: r.width, height: r.height, fontSize };
    };
    const boxes = [];
    for (const g of svg.querySelectorAll('[data-testid^="participant-"]')) {
      const owner = g.getAttribute('data-testid') ?? '';
      for (const el of g.querySelectorAll('[data-part]')) {
        boxes.push(box(el, el.getAttribute('data-part') ?? '', owner));
      }
    }
    for (const g of svg.querySelectorAll('[data-testid^="zone-"]')) {
      const owner = g.getAttribute('data-testid') ?? '';
      const members = (g.getAttribute('data-members') ?? '')
        .split(' ')
        .filter((m) => m !== '')
        .map((m) => `participant-${m}`);
      for (const el of g.querySelectorAll('[data-part]')) {
        boxes.push({ ...box(el, el.getAttribute('data-part') ?? '', owner), members });
      }
    }
    return { scene: box(svg, 'scene', 'scene'), boxes };
  });
}

/**
 * Everything wrong with the boxes: a box outside the scene; two drawn things on top of each
 * other; and, for zone frames (M1.2b), a frame over another zone, a member outside its frame or
 * a stranger inside it.
 */
function layoutProblems(scene: Box, boxes: readonly Box[]): string[] {
  const out = boxes.filter((b) => !inside(b, scene)).map((b) => `${b.owner} ${b.what} outside`);
  const drawn = boxes.filter((b) => b.what !== 'frame');
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      const a = drawn[i];
      const b = drawn[j];
      if (a !== undefined && b !== undefined && overlap(a, b)) {
        out.push(`${a.owner} ${a.what} × ${b.owner} ${b.what}`);
      }
    }
  }
  for (const frame of boxes.filter((b) => b.what === 'frame')) {
    for (const b of boxes) {
      if (b === frame) continue;
      const own = b.owner === frame.owner || (frame.members ?? []).includes(b.owner);
      if (own && !inside(b, frame)) out.push(`${b.owner} ${b.what} leaves ${frame.owner}`);
      if (!own && overlap(b, frame)) out.push(`${b.owner} ${b.what} × ${frame.owner} frame`);
    }
  }
  return out;
}

const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

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
  await expect(scene.getByRole('img', { name: 'Схема урока «SQL-инъекция»' })).toBeVisible();
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
      expect(notes.map(squash)).toEqual([
        '203.0.113.66',
        '192.0.2.24',
        viewport.width < 500 ? 'bank-…example' : 'bank-login.example',
        'bank.example',
      ]);
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
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
  await expect(page.getByTestId('lesson-loading')).toHaveText('Загружаем урок…');
  release();
  await expect(page.getByTestId('scene')).toBeVisible();
  await expect(page.getByTestId('lesson-loading')).toHaveCount(0);
});
