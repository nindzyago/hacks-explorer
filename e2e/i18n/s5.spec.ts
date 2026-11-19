// M2.3a acceptance (oracle D): scenario S5 «Смена языка не теряет место» on the e2e build with
// two languages (`dist-e2e-i18n`, K106): fixture lessons B1 in ru and en, the real interface
// strings of content/locales/<lang>/ui.md. Plus the language of a new visitor (D3, K96), the
// remembered choice and the address winning over it.
import type { Page } from '@playwright/test';
import { expect, openApp, test } from '../support';

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
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 4');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  const before = await place(page);
  expect(before).toMatchObject({ lesson: 'B1', step: 3, defence: false, locale: 'ru' });

  // When locale.set en
  expect(await run(page, 'locale.set', { lang: 'en' })).toEqual({ ok: true });

  // Then the same step and mode; every visible string in English; the address starts with /en/.
  await expect(page.getByTestId('lesson-title')).toHaveText('A training attack');
  expect(await place(page)).toEqual({ ...before, locale: 'en' });
  expect(path(page)).toBe('/en/lesson/B1#step-3');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('player-status')).toHaveText('Step 3 of 4');
  await expect(page.getByTestId('defence-off')).toHaveText('No defence');
  await expect(page.getByTestId('depth-steps')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('depth-steps')).toHaveText('Step by step');
  await expect(page.getByTestId('explain-step')).toHaveText('Step 3 of 4. Let through');
  await expect(page.locator('#log-title')).toHaveText('Attack flow');
  await expect(page.getByTestId('step-row-1').getByTestId('step-mark')).toContainText('normal');
  await expect(page.getByTestId('player-speed')).toHaveAttribute(
    'aria-label',
    'Speed 2×, press for 0.5×',
  );
  await expect(page.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');
  const russian = (await wordsNotIn(page, 'en')).filter((t) => CYRILLIC.test(t));
  expect(russian).toEqual([]);

  // And back: the Russian strings return, the place stays.
  expect(await run(page, 'locale.set', { lang: 'ru' })).toEqual({ ok: true });
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 4');
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
  await expect(page.getByTestId('player-status')).toHaveText('Step 2 of 4');
  await expect(page.getByTestId('defence-on')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('defence-name')).toHaveText('Defence: A check on the server');
  expect(path(page)).toBe('/en/lesson/B1#step-2-defence');
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('en');

  // The next visit without a language in the address opens English.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/lesson\/I1$/);
  // The address wins over the remembered choice.
  await openApp(page, '/ru/lesson/B1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 1 из 4');
  // Opening an address is not a choice: the remembered language stays.
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('en');
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
