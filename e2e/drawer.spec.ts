// M2.1b acceptance (design M2.1 D1 a, E2–E4, E6; K112–K114), oracle D: scenario S7 on the real
// catalog — the lessons panel shows all 12 sections and 75 topics, «sql» finds B1 and B8, the
// section «Сеть» its seven topics, a query with no result a hint and a reset; Esc, a click outside
// and the close button close it and focus returns; a ready lesson opens from it and the address
// follows; the glossary tab lists the terms and opens a definition; the page stays one screen;
// the phone gets a full-width sheet. Screenshots go to DRAWER_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;

async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await sceneReady(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['DRAWER_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

async function run(page: Page, id: string, params?: unknown) {
  return page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [id, params] as const);
}

const topics = (page: Page) =>
  page
    .getByTestId('catalog-topic')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-topic') ?? ''));

async function openLessons(page: Page): Promise<void> {
  await page.getByTestId('open-lessons').click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  await expect(page.getByTestId('catalog')).toHaveAttribute('data-state', 'ready');
}

/** The page height, sideways scroll and the drawer's box. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const drawer = document.querySelector('[data-testid="drawer"]')?.getBoundingClientRect();
    return {
      height: root.scrollHeight,
      inner: window.innerHeight,
      sideways: root.scrollWidth - window.innerWidth,
      drawer: drawer === undefined ? null : { left: drawer.left, width: drawer.width },
      width: window.innerWidth,
    };
  });
}

test.describe('S7: the lessons panel', () => {
  test('all 12 sections and 75 topics; ready lessons are links, the rest «скоро»', async ({
    page,
  }, testInfo) => {
    await openApp(page);
    await openLessons(page);
    await expect(page.getByTestId('catalog-group')).toHaveCount(12);
    expect(await topics(page)).toHaveLength(75);
    await expect(page.getByTestId('catalog-status')).toHaveText('Готово уроков: 3 из 75');
    const b = page.locator('[data-testid="catalog-group"][data-section="B"]');
    await expect(b.getByTestId('catalog-count')).toHaveText('готово 1 из 8');
    // B1 is a link to its address; B8 is not focusable and says «скоро»; I1 carries «открыть».
    await expect(page.locator('[data-topic="I1"] a')).toContainText('открыть');
    const b1 = page.locator('[data-topic="B1"] a');
    await expect(b1).toHaveAttribute('href', '/ru/lesson/B1');
    await expect(b1).toHaveAttribute('aria-current', 'page');
    const b8 = page.locator('[data-topic="B8"]');
    await expect(b8).toHaveAttribute('data-ready', 'false');
    await expect(b8).toContainText('скоро');
    await expect(b8.locator('a, button, [tabindex]')).toHaveCount(0);
    // Focus starts in the search field.
    await expect(page.getByTestId('catalog-search')).toBeFocused();
    await keep(page, testInfo, 'drawer-lessons-1280x720');
  });

  test('S7: «sql» → B1, B8 first; then the section «Сеть» → its seven topics; nothing found → a hint and a reset', async ({
    page,
  }, testInfo) => {
    await openApp(page);
    await openLessons(page);
    await page.getByTestId('catalog-search').fill('sql');
    expect((await topics(page)).slice(0, 2)).toEqual(['B1', 'B8']);
    await expect(page.getByTestId('catalog-status')).toHaveText('Найдено тем: 2');
    await keep(page, testInfo, 'drawer-search-sql-1280x720');

    // Choosing a section shows the whole section: the query is cleared (K114).
    await page.getByTestId('catalog-section').selectOption({ label: 'G. Сеть' });
    expect(await topics(page)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']);
    await expect(page.getByTestId('catalog-search')).toHaveValue('');
    await expect(page.getByTestId('catalog-status')).toHaveText('Найдено тем: 7');
    // A query typed after the section searches inside it.
    await page.getByTestId('catalog-search').fill('dns');
    expect(await topics(page)).toEqual(['G2']);

    // A query that matches nothing: a hint and a reset button, not an empty panel.
    await page.getByTestId('catalog-section').selectOption('');
    await page.getByTestId('catalog-search').fill('кракозябра');
    await expect(page.getByTestId('catalog-empty')).toBeVisible();
    await expect(page.getByTestId('catalog-empty')).toContainText('Ничего не нашлось');
    await expect(page.getByTestId('catalog-topic')).toHaveCount(0);
    await keep(page, testInfo, 'drawer-empty-1280x720');
    await page.getByTestId('catalog-reset').click();
    await expect(page.getByTestId('catalog-search')).toHaveValue('');
    await expect(page.getByTestId('catalog-search')).toBeFocused();
    expect(await topics(page)).toHaveLength(75);

    // Case, ё, ids and the name of a section.
    await page.getByTestId('catalog-search').fill('SQL');
    expect(await topics(page)).toEqual(['B1', 'B8']);
    await page.getByTestId('catalog-search').fill('g6');
    expect(await topics(page)).toEqual(['G6']);
    await page.getByTestId('catalog-search').fill('сеть');
    expect(await topics(page)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']);
    // Only punctuation is no query: everything, and the status shows the total.
    await page.getByTestId('catalog-search').fill(' -- ');
    expect(await topics(page)).toHaveLength(75);
    await expect(page.getByTestId('catalog-status')).toHaveText('Готово уроков: 3 из 75');
  });

  test('the player takes no keys while the panel is open, on a lesson link and on a tab', async ({
    page,
  }) => {
    await openApp(page);
    await openLessons(page);
    const player = () => page.evaluate(() => window.__app?.state.get().player);
    const before = await player();
    await page.locator('[data-topic="I1"] a').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('d');
    await page.keyboard.press('ArrowLeft');
    expect(await player()).toEqual(before);
    await page.getByTestId('drawer-tab-lessons').focus();
    await page.keyboard.press('d');
    await page.keyboard.press('D');
    expect(await player()).toEqual(before);
    await expect(page.getByTestId('drawer')).toHaveAttribute('data-tab', 'lessons');
    // Closed again, the same keys move the player.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__app?.state.get().drawer)).toBeNull();
    await page.keyboard.press('d');
    await expect.poll(async () => (await player())?.defence).toBe(true);
  });

  test('a switch of tab keeps the search and the section; closing the panel clears them', async ({
    page,
  }) => {
    await openApp(page);
    await openLessons(page);
    await page.getByTestId('catalog-search').fill('sql');
    await page.getByTestId('drawer-tab-glossary').click();
    await expect(page.getByTestId('glossary-list')).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('glossary-search').fill('фишинг');
    await page.getByTestId('drawer-tab-lessons').click();
    await expect(page.getByTestId('catalog-search')).toHaveValue('sql');
    expect(await topics(page)).toEqual(['B1', 'B8']);
    await page.getByTestId('drawer-tab-glossary').click();
    await expect(page.getByTestId('glossary-search')).toHaveValue('фишинг');
    await page.keyboard.press('Escape');
    await openLessons(page);
    await expect(page.getByTestId('catalog-search')).toHaveValue('');
    expect(await topics(page)).toHaveLength(75);
  });

  test('any change of lesson closes the panel: Back and the control channel', async ({ page }) => {
    await openApp(page, '/ru/lesson/B1');
    await run(page, 'lesson.open', { id: 'I1' });
    await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
    await openLessons(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
    await expect(page.getByTestId('drawer')).toBeHidden();
    await openLessons(page);
    expect(await run(page, 'lesson.open', { id: 'I1' })).toEqual({ ok: true });
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page.getByTestId('lesson-title')).toHaveText('Фишинг');
  });

  test('the panel is not in the first load: its code comes when it first opens', async ({
    page,
  }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await openApp(page);
    const first = [...scripts];
    await expect(page.getByTestId('drawer')).toHaveCount(0);
    await openLessons(page);
    expect(scripts.length).toBeGreaterThan(first.length);
  });

  test('Esc, a click outside and the close button close it; focus returns to the button', async ({
    page,
  }) => {
    await openApp(page);
    await openLessons(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page.getByTestId('open-lessons')).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.__app?.state.get().drawer)).toBeNull();

    await openLessons(page);
    // The backdrop on the right of the panel.
    await page.mouse.click(1200, 400);
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page.getByTestId('open-lessons')).toBeFocused();

    await page.getByTestId('open-glossary').click();
    await expect(page.getByTestId('drawer')).toHaveAttribute('data-tab', 'glossary');
    await page.getByTestId('drawer-close').click();
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page.getByTestId('open-glossary')).toBeFocused();
    // Right after a close the panel opens again by a command and stays open.
    expect(await run(page, 'drawer.open', { tab: 'glossary' })).toEqual({ ok: true });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await expect(page.getByTestId('drawer')).toBeVisible();
    expect(await run(page, 'drawer.close')).toEqual({ ok: true });
    expect(await run(page, 'drawer.open', { tab: 'glossary' })).toEqual({ ok: true });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await expect(page.getByTestId('drawer')).toBeVisible();
    expect(await run(page, 'drawer.close')).toEqual({ ok: true });
    await expect(page.getByTestId('open-glossary')).toBeFocused();

    // Opened by a command, closed by one: the panel follows the state. Nothing had focus, so
    // it goes to «Уроки».
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    expect(await run(page, 'drawer.open', { tab: 'lessons' })).toEqual({ ok: true });
    await expect(page.getByTestId('drawer')).toBeVisible();
    expect(await run(page, 'drawer.close')).toEqual({ ok: true });
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page.getByTestId('open-lessons')).toBeFocused();
  });

  test('focus moves once on close: the late close event does not take it back', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByTestId('open-glossary').click();
    await expect(page.getByTestId('drawer')).toBeVisible();
    // The browser removes `open` at once and fires the close event a task later. Focus moved in
    // between (the reader went on, here to «Уроки») stays where it went.
    const focused = await page.evaluate(async () => {
      const dialog = document.querySelector('[data-testid="drawer"]');
      const other = document.querySelector('[data-testid="open-lessons"]');
      if (!(dialog instanceof HTMLDialogElement) || !(other instanceof HTMLElement)) return null;
      const closed = new Promise((resolve) => {
        dialog.addEventListener('close', resolve, { once: true });
      });
      const observer = new MutationObserver(() => {
        if (!dialog.open) other.focus();
      });
      observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
      window.__app?.commands.run('drawer.close');
      await closed;
      observer.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return document.activeElement instanceof HTMLElement
        ? (document.activeElement.dataset['testid'] ?? null)
        : null;
    });
    expect(focused).toBe('open-lessons');
    await expect.poll(() => page.evaluate(() => window.__app?.state.get().drawer)).toBeNull();
  });

  test('a ready lesson opens from the panel and the address follows; Back returns', async ({
    page,
  }) => {
    await openApp(page, '/ru/lesson/B1');
    await openLessons(page);
    await page.getByTestId('catalog-search').fill('фишинг');
    await page.locator('[data-topic="I1"] a').click();
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
    await expect(page.getByTestId('lesson-title')).toHaveText('Фишинг');
    await page.goBack();
    await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
    await expect(page.getByTestId('lesson-title')).toHaveText('SQL-инъекция');
    // By keyboard: Enter on the link.
    await openLessons(page);
    await page.getByTestId('catalog-search').fill('I1');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-topic="I1"] a')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
    await expect(page.getByTestId('drawer')).toBeHidden();
  });

  test('the panel opens on a page that is not found: a way back to the catalog', async ({
    page,
  }) => {
    await page.goto('/ru/no-such-page');
    await expect(page.getByTestId('page-not-found')).toBeVisible();
    await openLessons(page);
    await page.locator('[data-topic="B1"] a').click();
    await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
    await expect(page.getByTestId('scene')).toBeVisible();
  });
});

test.describe('the glossary tab', () => {
  test('lists the terms by category, searches, opens a definition and goes back', async ({
    page,
  }, testInfo) => {
    await openApp(page);
    await page.getByTestId('open-glossary').click();
    await expect(page.getByTestId('glossary-list')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('glossary-search')).toBeFocused();
    expect(await page.getByTestId('glossary-term').count()).toBeGreaterThanOrEqual(25);
    await keep(page, testInfo, 'drawer-glossary-1280x720');

    await page.getByTestId('glossary-search').fill('фишинг');
    await expect(page.locator('[data-testid="glossary-term"][data-term="phishing"]')).toBeVisible();
    await page.locator('[data-testid="glossary-term"][data-term="phishing"]').click();
    await expect(page.getByTestId('glossary-entry')).toHaveAttribute('data-term', 'phishing');
    await expect(page.getByTestId('glossary-entry-definition')).not.toBeEmpty();
    await expect(page.getByTestId('glossary-entry-title')).toBeFocused();
    expect(await page.evaluate(() => window.__app?.state.get())).toMatchObject({
      drawer: 'glossary',
      glossary: 'phishing',
    });
    // No popover behind the panel.
    await expect(page.getByTestId('glossary-popover')).toHaveCount(0);
    await keep(page, testInfo, 'drawer-glossary-term-1280x720');

    // «См. также» opens the next term in the panel.
    const see = page.getByTestId('glossary-entry-see').first();
    const next = await see.getAttribute('data-term');
    await see.click();
    await expect(page.getByTestId('glossary-entry')).toHaveAttribute('data-term', next ?? '');

    await page.getByTestId('glossary-back').click();
    await expect(page.getByTestId('glossary-entry')).toHaveCount(0);
    await expect(page.getByTestId('glossary-term').first()).toBeVisible();

    await page.getByTestId('glossary-search').fill('zzzz');
    await expect(page.getByTestId('glossary-empty')).toBeVisible();
    await page.getByTestId('glossary-reset').click();
    await expect(page.getByTestId('glossary-search')).toHaveValue('');

    // Esc closes the panel and the term with it; the popover works again outside.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('drawer')).toBeHidden();
    expect(await page.evaluate(() => window.__app?.state.get().glossary)).toBeNull();
    await page.getByTestId('term').first().click();
    await expect(page.getByTestId('glossary-popover')).toBeVisible();
  });

  test('a related lesson opens from a definition and closes the panel', async ({ page }) => {
    await openApp(page, '/ru/lesson/I1');
    await run(page, 'drawer.open', { tab: 'glossary' });
    await run(page, 'glossary.open', { id: 'sql-injection' });
    await expect(page.getByTestId('glossary-entry')).toHaveAttribute('data-term', 'sql-injection');
    await page.locator('[data-testid="glossary-entry-lesson"][data-lesson="B1"]').click();
    await expect(page.getByTestId('drawer')).toBeHidden();
    await expect(page).toHaveURL(/\/ru\/lesson\/B1$/);
  });

  test('tabs switch by click and by arrow keys', async ({ page }) => {
    await openApp(page);
    await openLessons(page);
    await page.getByTestId('drawer-tab-lessons').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('drawer')).toHaveAttribute('data-tab', 'glossary');
    await expect(page.getByTestId('drawer-tab-glossary')).toBeFocused();
    await expect(page.getByTestId('drawer-tab-glossary')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('drawer-tab-lessons').click();
    await expect(page.getByTestId('catalog')).toBeVisible();
  });
});

test.describe('layout', () => {
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    test(`one screen still holds at ${String(size.width)}×${String(size.height)}, panel open or not`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      for (const lesson of ['B1', 'I1']) {
        await openApp(page, `/ru/lesson/${lesson}`);
        const closed = await geometry(page);
        expect(closed.height).toBe(closed.inner);
        expect(closed.sideways).toBe(0);
        // The two buttons stand in the top bar, 44 px tall.
        const box = await page.getByTestId('open-lessons').boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        const top = await page.getByTestId('topbar').boundingBox();
        expect(top?.height).toBeLessThanOrEqual(48);
        await openLessons(page);
        const open = await geometry(page);
        expect(open.height).toBe(open.inner);
        expect(open.sideways).toBe(0);
        expect(open.drawer?.left).toBe(0);
        expect(open.drawer?.width).toBeLessThanOrEqual(28 * 16);
        await page.keyboard.press('Escape');
      }
    });
  }

  for (const size of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
  ]) {
    test(`phone ${String(size.width)}: a full-width sheet, no sideways scroll, 44 px targets`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(size);
      await openApp(page);
      const closed = await geometry(page);
      expect(closed.sideways).toBe(0);
      await openLessons(page);
      const open = await geometry(page);
      expect(open.drawer).toEqual({ left: 0, width: size.width });
      expect(open.sideways).toBe(0);
      // No horizontal scroll inside the panel either.
      const inner = await page.getByTestId('drawer').evaluate((el) => {
        const body = el.querySelector('[role="tabpanel"]');
        return body === null ? -1 : body.scrollWidth - body.clientWidth;
      });
      expect(inner).toBe(0);
      const small = await page
        .locator(
          '[data-testid="drawer"] a, [data-testid="drawer"] button, [data-testid="drawer"] input, [data-testid="drawer"] select',
        )
        .evaluateAll((els) =>
          els
            .filter((el) => el.getBoundingClientRect().height > 0)
            .filter((el) => el.getBoundingClientRect().height < 44)
            .map((el) => el.outerHTML.slice(0, 80)),
        );
      expect(small).toEqual([]);
      // On a phone the keyboard would cover the list: the tab takes focus, not the field.
      await expect(page.getByTestId('drawer-tab-lessons')).toBeFocused();
      if (size.width === 390) {
        await keep(page, testInfo, 'drawer-lessons-390x844');
        await page.getByTestId('catalog-search').fill('sql');
        await keep(page, testInfo, 'drawer-search-sql-390x844');
        await page.getByTestId('catalog-search').fill('кракозябра');
        await keep(page, testInfo, 'drawer-empty-390x844');
        await page.getByTestId('drawer-tab-glossary').click();
        await expect(page.getByTestId('glossary-list')).toHaveAttribute('data-state', 'ready');
        await keep(page, testInfo, 'drawer-glossary-390x844');
      }
    });
  }
});

test.describe('in English (M2.3, K105)', () => {
  test('the panel speaks English: tabs, counts, search, «soon», the glossary', async ({ page }) => {
    await openApp(page, '/en/lesson/B1');
    await expect(page.getByTestId('open-lessons')).toHaveText('Lessons');
    await expect(page.getByTestId('open-glossary')).toHaveText('Glossary');
    await openLessons(page);
    expect(await topics(page)).toHaveLength(75);
    await expect(page.getByTestId('catalog-status')).toHaveText('Lessons ready: 3 of 75');
    await expect(
      page.locator('[data-testid="catalog-group"][data-section="B"] [data-testid="catalog-count"]'),
    ).toHaveText('1 of 8 ready');
    await page.getByTestId('catalog-search').fill('sql');
    expect(await topics(page)).toEqual(['B1', 'B8']);
    await expect(page.locator('[data-topic="B8"]')).toContainText('soon');
    await expect(page.locator('[data-topic="B1"] a')).toHaveAttribute('href', '/en/lesson/B1');
    await page.getByTestId('catalog-search').fill('');
    await page.getByTestId('catalog-section').selectOption({ label: 'G. Network' });
    expect(await topics(page)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']);
    const cyrillic = /[Ѐ-ӿ]/;
    expect(await page.getByTestId('drawer').innerText()).not.toMatch(cyrillic);
    await page.getByTestId('drawer-tab-glossary').click();
    await expect(page.getByTestId('glossary-list')).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('glossary-search').fill('phishing');
    await page.locator('[data-testid="glossary-term"][data-term="phishing"]').click();
    await expect(page.getByTestId('glossary-entry-title')).toHaveText(/phishing/i);
    expect(await page.getByTestId('drawer').innerText()).not.toMatch(cyrillic);
  });
});
