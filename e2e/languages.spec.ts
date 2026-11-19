// M2.3a (K94, K106): the real site has Russian only until the English lessons land (M2.3b): no
// language switch, `<html lang="ru">`, `locale.set en` refused, English addresses fall back.
import { expect, openApp, test } from './support';

test('a site with one language shows no switch and refuses another language', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('languages')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  const result = await page.evaluate(() =>
    window.__app?.commands.run('locale.set', { lang: 'en' }),
  );
  expect(result?.ok === false && result.error.code).toBe('invalid-params');
  expect(await page.evaluate(() => window.__app?.state.get().locale)).toBe('ru');
});

test.describe('an English browser', () => {
  test.use({ locale: 'en-US' });
  test('still gets Russian while the site has only Russian', async ({ page }) => {
    await openApp(page, '/en/lesson/B1#step-2');
    await expect(page).toHaveURL(/\/ru\/lesson\/B1#step-2$/);
    await expect(page.getByTestId('player-status')).toHaveText('Шаг 2 из 5');
  });
});
