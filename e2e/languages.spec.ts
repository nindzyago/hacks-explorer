// M2.3 acceptance (oracle D): scenario S5 «Смена языка не теряет место» on the real site, which
// has Russian and English since M2.3b (the real lessons B1 and I1, the real glossaries and
// interface strings). Plus the language of a new visitor (D3, K96), the remembered choice and the
// address winning over it, and no Russian left on any English step.
import type { Page } from '@playwright/test';
import { expect, openApp, sceneReady, test } from './support';

const STORAGE_KEY = 'hacks-explorer.language';
const CYRILLIC = /[Ѐ-ӿ]/;

async function run(page: Page, id: string, params?: unknown) {
  return page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [id, params] as const);
}

async function place(page: Page) {
  return page.evaluate(() => {
    const s = window.__app?.state.get();
    return s === undefined
      ? null
      : {
          lesson: s.lesson,
          step: s.player.step,
          defence: s.player.defence,
          depth: s.depth,
          speed: s.player.speed,
          locale: s.locale,
        };
  });
}

const path = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.hash}`;
};

/**
 * Every piece of text a reader can see or hear in the page, outside elements marked with another
 * language (the «RU» button is titled «Русский»): text nodes, aria-label, title, alt.
 */
async function wordsNotIn(page: Page, lang: string): Promise<string[]> {
  return page.evaluate((own) => {
    const out: string[] = [];
    const foreign = (el: Element | null) => {
      const tagged = el?.closest('[lang]');
      return tagged !== null && tagged !== undefined && tagged.getAttribute('lang') !== own;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      if (text.trim() !== '' && !foreign(n.parentElement)) out.push(text.trim());
    }
    for (const el of Array.from(document.body.querySelectorAll('[aria-label],[title],[alt]'))) {
      if (foreign(el)) continue;
      for (const name of ['aria-label', 'title', 'alt']) {
        const value = el.getAttribute(name);
        if (value !== null) out.push(value);
      }
    }
    out.push(document.title);
    return out;
  }, lang);
}

test('S5: B1 step 3 in Russian → locale.set en → the same step and mode, English, /en/', async ({
  page,
}) => {
  // Given lesson B1, step 3, language ru (and a depth and speed of the reader's own).
  await openApp(page, '/ru/lesson/B1#step-3');
  expect(await run(page, 'depth.set', { depth: 'steps' })).toEqual({ ok: true });
  expect(await run(page, 'player.speed', { value: 2 })).toEqual({ ok: true });
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 5');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  const before = await place(page);
  expect(before).toMatchObject({ lesson: 'B1', step: 3, defence: false, locale: 'ru' });

  // When locale.set en
  expect(await run(page, 'locale.set', { lang: 'en' })).toEqual({ ok: true });

  // Then the same step and mode; every visible string in English; the address starts with /en/.
  await expect(page.getByTestId('lesson-title')).toHaveText('SQL injection');
  expect(await place(page)).toEqual({ ...before, locale: 'en' });
  expect(path(page)).toBe('/en/lesson/B1#step-3');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('player-status')).toHaveText('Step 3 of 5');
  await expect(page.getByTestId('defence-off')).toHaveText('No defence');
  await expect(page.getByTestId('depth-steps')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('depth-steps')).toHaveText('Step by step');
  await expect(page.getByTestId('explain-step')).toHaveText(
    'Step 3 of 5. The server glues the query together',
  );
  await expect(page.locator('#log-title')).toHaveText('Attack flow');
  await expect(page.getByTestId('step-row-1').getByTestId('step-mark')).toContainText('normal');
  await expect(page.getByTestId('player-speed')).toHaveAttribute(
    'aria-label',
    'Speed 2×, press for 0.5×',
  );
  await expect(page.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');
  const russian = (await wordsNotIn(page, 'en')).filter((t) => CYRILLIC.test(t));
  expect(russian).toEqual([]);
  // K109: the description meta follows the language too; M4.3: it is the lesson's own, in the
  // English template (content/locales/en/ui.md, meta.lesson.description).
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /^Injection into a database query\. .+\. How to stop it: .+\.$/,
  );
  await expect(page).toHaveTitle('SQL injection — Hacks Explorer');

  // And back: the Russian strings return, the place stays.
  expect(await run(page, 'locale.set', { lang: 'ru' })).toEqual({ ok: true });
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 5');
  expect(await place(page)).toEqual(before);
  expect(path(page)).toBe('/ru/lesson/B1#step-3');
});

test('the RU / EN switch runs locale.set, keeps the defence mode and is remembered', async ({
  page,
}) => {
  await openApp(page, '/ru/lesson/B1#step-2-defence');
  const group = page.getByTestId('languages');
  await expect(group).toHaveAttribute('aria-label', 'Язык сайта');
  await expect(page.getByTestId('language-ru')).toHaveAttribute('aria-pressed', 'true');
  const en = page.getByTestId('language-en');
  await expect(en).toHaveText('EN');
  await expect(en).toHaveAttribute('lang', 'en');
  expect((await en.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await en.click();
  await expect(page.getByTestId('player-status')).toHaveText('Step 2 of 5');
  await expect(page.getByTestId('defence-on')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('defence-name')).toHaveText('Defence: Parameterized query');
  expect(path(page)).toBe('/en/lesson/B1#step-2-defence');
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('en');

  // K108: Back undoes the switch (the previous language, the same place) and is not a choice:
  // the remembered language stays. Forward brings English back.
  await page.goBack();
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 2 из 5');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(path(page)).toBe('/ru/lesson/B1#step-2-defence');
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('en');
  await page.goForward();
  await expect(page.getByTestId('player-status')).toHaveText('Step 2 of 5');
  expect(path(page)).toBe('/en/lesson/B1#step-2-defence');

  // The next visit without a language in the address opens English.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/lesson\/I1$/);
  // Let I1 finish loading its icons and fonts: leaving earlier aborts them (a reported problem).
  await sceneReady(page);
  // The address wins over the remembered choice.
  await openApp(page, '/ru/lesson/B1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 1 из 5');
  // Opening an address is not a choice: the remembered language stays.
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('en');
});

test('an unknown page under /en/ says so in English, whatever the browser (K110)', async ({
  page,
}) => {
  await page.goto('/en/nope');
  await expect(page.getByTestId('not-found-title')).toHaveText('There is no such page');
  await expect(page.getByTestId('not-found-home')).toHaveText('Home page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('There is no such page — Hacks Explorer');
  expect(path(page)).toBe('/en/nope');
});

test('a glossary term opens its English definition', async ({ page }) => {
  await openApp(page, '/en/lesson/B1');
  await page.getByTestId('scene').locator('[data-term="attacker"]').first().click();
  await expect(page.getByTestId('glossary-title')).toHaveText('Attacker');
  await expect(page.getByTestId('glossary-close')).toHaveAttribute('aria-label', 'Close');
});

test('locale.set refuses hostile values and changes nothing', async ({ page }) => {
  await openApp(page, '/ru/lesson/B1#step-3');
  const before = await place(page);
  for (const params of [{ lang: 'de' }, { lang: 'EN' }, { lang: '__proto__' }, { lang: 7 }, {}]) {
    const result = await run(page, 'locale.set', params);
    expect(result?.ok === false && result.error.code).toBe('invalid-params');
  }
  expect(await place(page)).toEqual(before);
  expect(path(page)).toBe('/ru/lesson/B1#step-3');
});

test('an unknown language in the address is the reader’s language, rewritten', async ({ page }) => {
  await openApp(page, '/de/lesson/B1#step-2');
  expect(path(page)).toBe('/ru/lesson/B1#step-2');
});

for (const [locale, want] of [
  ['en-US', 'en'],
  ['de-DE', 'en'],
  ['uk-UA', 'ru'],
  ['kk-KZ', 'ru'],
  ['ru-RU', 'ru'],
] as const) {
  test.describe(`a new visitor with a ${locale} browser`, () => {
    test.use({ locale });
    test(`gets ${want} (D3, K96)`, async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(new RegExp(`/${want}/lesson/I1$`));
      await expect(page.locator('html')).toHaveAttribute('lang', want);
    });
  });
}

test.describe('a hostile remembered language', () => {
  test.use({ locale: 'en-US' });
  test('is ignored for the browser language', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '__proto__');
    }, STORAGE_KEY);
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/lesson\/I1$/);
  });
});

// M2.3b: every step of both English lessons, in both modes and at every depth, shows no Russian.
for (const lesson of ['B1', 'I1']) {
  test(`${lesson} in English has no Russian on any step, mode or depth`, async ({ page }) => {
    await openApp(page, `/en/lesson/${lesson}`);
    for (const defence of [false, true]) {
      expect(await run(page, 'defence.set', { on: defence })).toEqual({ ok: true });
      const counts = () =>
        page.evaluate(() => window.__app?.state.get().player.counts ?? { without: 0, with: 0 });
      await expect.poll(async () => (await counts()).with).toBeGreaterThan(0);
      const { without, with: withDefence } = await counts();
      const count = defence ? withDefence : without;
      expect(count).toBeGreaterThan(0);
      for (let step = 1; step <= count; step++) {
        expect(await run(page, 'player.goto', { step })).toEqual({ ok: true });
        await expect(page.getByTestId('player-status')).toHaveText(
          `Step ${String(step)} of ${String(count)}`,
        );
        for (const depth of ['simple', 'steps', 'deep']) {
          expect(await run(page, 'depth.set', { depth })).toEqual({ ok: true });
          const russian = (await wordsNotIn(page, 'en')).filter((t) => CYRILLIC.test(t));
          expect(russian, `step ${String(step)}, defence ${String(defence)}, ${depth}`).toEqual([]);
        }
      }
    }
  });
}
