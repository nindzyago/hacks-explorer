// M2.2: a deep link into the production build, served the way Cloudflare serves it (any unknown
// path answers with index.html). Scripts, styles, fonts, icons and lesson data must come from
// absolute paths: a relative one would be asked for under /ru/lesson/ and get index.html, which
// the support fixture reports as a page problem or the page shows as broken.
import { expect, sceneReady, test } from '../support';

// UI2: a lesson plays by itself when it opens; these tests count steps by hand, so they ask for
// less motion, which opens the lesson paused (e2e/production/autoplay.spec.ts tests the play).
test.use({ reducedMotion: 'reduce' });

test('a deep link loads the lesson at its step and mode, and survives a reload', async ({
  page,
}) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(new URL(request.url()).pathname));
  await page.goto('/ru/lesson/B1#step-3-defence');
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 3 из 5');
  await expect(page.getByTestId('defence-toggle')).toHaveAttribute('data-defence', 'true');
  await sceneReady(page);
  await expect(page.getByTestId('participant-attacker').locator('image')).toHaveCount(1);
  // Nothing but the page itself was asked for under the lesson's path.
  expect(asked.filter((path) => path.startsWith('/ru/'))).toEqual(['/ru/lesson/B1']);
  expect(asked.some((path) => path.startsWith('/data/lessons/B1.ru.'))).toBe(true);
  expect(asked.some((path) => path.startsWith('/fonts/'))).toBe(true);

  await page.getByTestId('player-next').click();
  await expect(page).toHaveURL(/\/ru\/lesson\/B1#step-4-defence$/);
  await page.reload();
  await expect(page.getByTestId('player-status')).toHaveText('Шаг 4 из 5');
  await expect(page.getByTestId('defence-toggle')).toHaveAttribute('data-defence', 'true');
});

// M2.1a (E5, K7): the default lesson is «Фишинг».
test('the home page of the production build opens the default lesson', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru\/lesson\/I1$/);
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'I1');
});
