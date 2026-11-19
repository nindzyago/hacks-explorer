// M2.4 acceptance (oracle D S3 + K7): a glossary word in the text of a B1 step opens its
// definition in place; «см. также» opens the next one; Esc closes and returns focus; an icon and
// a zone label on the scene open their terms; one definition at a time; the player keys are
// quiet while it is open; on a phone it is a sheet with no sideways scroll; the glossary file is
// loaded only when the first term opens. Expected texts come from the built glossary file.
// Screenshots go to GLOSSARY_SHOTS when it names a folder.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { SiteGlossary } from '../src/core/glossary/site';
import { readSiteGlossary } from '../src/core/glossary/site';
import { expect, openApp, sceneReady, test } from './support';

const SHOT = { animations: 'disabled', caret: 'hide' } as const;
const POPOVER = 'glossary-popover';

async function keep(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ ...SHOT, path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const folder = process.env['GLOSSARY_SHOTS'];
  if (folder !== undefined && folder !== '') {
    mkdirSync(folder, { recursive: true });
    copyFileSync(path, join(folder, `${name}.png`));
  }
}

async function glossary(page: Page): Promise<SiteGlossary> {
  const text = await page.evaluate(async () => (await fetch('/data/glossary/ru.json')).text());
  const json: unknown = JSON.parse(text);
  const read = readSiteGlossary(json, 'ru');
  if (!read.ok) throw new Error(read.error.message);
  return read.value;
}

function termOf(g: SiteGlossary, id: string) {
  const term = g.terms.find((t) => t.id === id);
  if (term === undefined) throw new Error(`no term ${id}`);
  return term;
}

/** B1 at the first step whose «Просто» text has a glossary word; the clock stopped. */
async function stepWithTerm(page: Page): Promise<void> {
  await openApp(page);
  await page.evaluate(() => window.__app?.clock.set(0));
  await expect(page.getByTestId('step-row-5')).toBeVisible();
  for (let step = 1; step <= 5; step += 1) {
    await page.evaluate((n) => window.__app?.commands.run('player.goto', { step: n }), step);
    if ((await page.getByTestId('explain-text').getByTestId('term').count()) > 0) return;
  }
  throw new Error('no B1 step has a glossary word in its «Просто» text');
}

async function openTermState(page: Page): Promise<unknown> {
  return page.evaluate(() => window.__app?.state.get().glossary);
}

test.describe('a glossary word in lesson text', () => {
  test('click opens its definition next to it; Esc closes and returns focus', async ({
    page,
  }, testInfo) => {
    await stepWithTerm(page);
    await sceneReady(page);
    const word = page.getByTestId('explain-text').getByTestId('term').first();
    const id = (await word.getAttribute('data-term')) ?? '';
    const g = await glossary(page);
    const term = termOf(g, id);

    await word.click();
    const pop = page.getByTestId(POPOVER);
    await expect(pop).toBeVisible();
    await expect(pop).toHaveAttribute('data-term', id);
    await expect(pop).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('glossary-title')).toHaveText(term.title);
    await expect(page.getByTestId('glossary-definition')).not.toBeEmpty();
    await expect(pop).toBeFocused();
    expect(await openTermState(page)).toBe(id);

    // It stands next to the word, inside the window.
    const w = await word.boundingBox();
    const p = await pop.boundingBox();
    if (w === null || p === null) throw new Error('no boxes');
    expect(Math.abs(p.y - (w.y + w.height)) < 20 || Math.abs(p.y + p.height - w.y) < 20).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(1280);
    await keep(page, testInfo, 'm24-term-open-1280');

    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(word).toBeFocused();
    expect(await openTermState(page)).toBeNull();
  });

  test('the keyboard: Tab to the word, Enter opens, player keys are quiet inside', async ({
    page,
  }) => {
    await stepWithTerm(page);
    const word = page.getByTestId('explain-text').getByTestId('term').first();
    const before = await page.evaluate(() => window.__app?.state.get().player);
    await word.focus();
    await page.keyboard.press('Enter');
    const pop = page.getByTestId(POPOVER);
    await expect(pop).toBeFocused();
    for (const key of ['ArrowRight', 'ArrowLeft', 'd', 'Space']) await page.keyboard.press(key);
    expect(await page.evaluate(() => window.__app?.state.get().player)).toEqual(before);
    await expect(pop).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(word).toBeFocused();
    // Space on the word opens it too, and does not play.
    await page.keyboard.press('Space');
    await expect(pop).toBeVisible();
    expect(await page.evaluate(() => window.__app?.state.get().player.playing)).toBe(false);
  });

  test('«см. также» opens the next definition; Esc still returns to the word', async ({
    page,
  }, testInfo) => {
    await stepWithTerm(page);
    const g = await glossary(page);
    const word = page.getByTestId('explain-text').getByTestId('term').first();
    const first = termOf(g, (await word.getAttribute('data-term')) ?? '');
    await word.click();
    const see = page.getByTestId('glossary-see');
    await expect(see).toHaveCount(first.see.length);
    const next = first.see[0] ?? '';
    await see.first().click();
    const pop = page.getByTestId(POPOVER);
    await expect(pop).toHaveAttribute('data-term', next);
    await expect(page.getByTestId('glossary-title')).toHaveText(termOf(g, next).title);
    await expect(page.getByTestId(POPOVER)).toHaveCount(1);
    await expect(pop).toBeFocused();
    await keep(page, testInfo, 'm24-see-also-1280');
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(word).toBeFocused();
  });

  test('a word inside a definition opens its own definition; one at a time', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__app?.commands.run('glossary.open', { id: 'sql-injection' }));
    const pop = page.getByTestId(POPOVER);
    await expect(pop).toHaveAttribute('data-state', 'ready');
    const inner = pop.getByTestId('term').first();
    const id = (await inner.getAttribute('data-term')) ?? '';
    expect(id).not.toBe('sql-injection');
    await inner.click();
    await expect(pop).toHaveAttribute('data-term', id);
    await expect(page.getByTestId(POPOVER)).toHaveCount(1);
  });

  test('a click elsewhere closes it; the close button returns focus', async ({ page }) => {
    await stepWithTerm(page);
    const word = page.getByTestId('explain-text').getByTestId('term').first();
    await word.click();
    const pop = page.getByTestId(POPOVER);
    await expect(pop).toBeVisible();
    await page.getByTestId('lesson-title').click();
    await expect(pop).toHaveCount(0);
    await word.click();
    await page.getByTestId('glossary-close').click();
    await expect(pop).toHaveCount(0);
    await expect(word).toBeFocused();
  });

  test('a related lesson opens that lesson', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__app?.commands.run('glossary.open', { id: 'phishing' }));
    const lesson = page.getByTestId('glossary-lesson');
    await expect(lesson).toHaveText(['Фишинг']);
    await lesson.click();
    await expect(page.getByTestId(POPOVER)).toHaveCount(0);
    await expect(page.getByTestId('lesson-title')).toHaveText('Фишинг');
  });

  test('an id that is not in the glossary says so instead of breaking', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__app?.commands.run('glossary.open', { id: 'no-such-word' }));
    await expect(page.getByTestId(POPOVER)).toHaveAttribute('data-state', 'unknown');
    await expect(page.getByTestId(POPOVER)).toContainText('Такого слова в словаре нет');
  });
});

test.describe('the scene', () => {
  test('a participant and a zone label open their terms', async ({ page }, testInfo) => {
    await openApp(page);
    await sceneReady(page);
    const g = await glossary(page);
    const pop = page.getByTestId(POPOVER);

    await page.getByTestId('participant-term-db').click();
    await expect(pop).toHaveAttribute('data-term', 'database');
    await expect(page.getByTestId('glossary-title')).toHaveText(termOf(g, 'database').title);
    await keep(page, testInfo, 'm24-participant-1280');

    await page.getByTestId('zone-term-site').click();
    await expect(pop).toHaveAttribute('data-term', 'trust-boundary');
    await expect(page.getByTestId(POPOVER)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('zone-term-site')).toBeFocused();

    // From the keyboard: Enter on the focused icon.
    await page.getByTestId('participant-term-attacker').focus();
    await page.keyboard.press('Enter');
    await expect(pop).toHaveAttribute('data-term', 'attacker');
  });

  test('I1: the fake page and the forgery zone', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__app?.commands.run('lesson.open', { id: 'I1' }));
    await expect(page.getByTestId('lesson-title')).toHaveText('Фишинг');
    await page.getByTestId('participant-term-fake').click();
    await expect(page.getByTestId(POPOVER)).toHaveAttribute('data-term', 'fake-page');
    await page.getByTestId('zone-term-forgery').click();
    await expect(page.getByTestId(POPOVER)).toHaveAttribute('data-term', 'phishing');
  });
});

test('the glossary file loads only when the first term opens, and only once', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/data/glossary/')) requests.push(r.url());
  });
  await stepWithTerm(page);
  expect(requests).toEqual([]);
  await page.getByTestId('explain-text').getByTestId('term').first().click();
  await expect(page.getByTestId(POPOVER)).toHaveAttribute('data-state', 'ready');
  await page.keyboard.press('Escape');
  await page.getByTestId('participant-term-db').click();
  await expect(page.getByTestId(POPOVER)).toHaveAttribute('data-state', 'ready');
  expect(requests.map((u) => new URL(u).pathname)).toEqual(['/data/glossary/ru.json']);
});

test.describe('on a phone', () => {
  for (const width of [360, 390]) {
    test(`${String(width)} px: a sheet at the bottom, no sideways scroll, 44 px targets`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      await stepWithTerm(page);
      await sceneReady(page);
      const word = page.getByTestId('explain-text').getByTestId('term').first();
      await word.scrollIntoViewIfNeeded();

      // The word takes a finger 44 px tall: points 20 px above and below its middle hit a word
      // (on a crowded line the neighbour's area may win there), the middle hits this word.
      const w = await word.boundingBox();
      if (w === null) throw new Error('no word box');
      const hits = await page.evaluate(
        ([x, y]) =>
          [-20, 0, 20].map(
            (dy) => document.elementFromPoint(x, y + dy)?.closest('[data-testid="term"]') !== null,
          ),
        [w.x + Math.min(w.width / 2, 10), w.y + w.height / 2] as const,
      );
      expect(hits).toEqual([true, true, true]);

      await word.click();
      const pop = page.getByTestId(POPOVER);
      await expect(pop).toHaveAttribute('data-state', 'ready');
      const p = await pop.boundingBox();
      if (p === null) throw new Error('no popover box');
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(width);
      expect(p.y + p.height).toBeLessThanOrEqual(800);
      expect(p.y + p.height).toBeGreaterThan(800 - 40);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sideways).toBe(0);
      for (const target of await page.getByTestId('glossary-see').all()) {
        expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      expect(
        (await page.getByTestId('glossary-close').boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(44);
      await keep(page, testInfo, `m24-phone-${String(width)}`);
    });
  }
});
