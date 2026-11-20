// UI2 (scenario S12): on the production build a lesson starts playing by itself when it opens —
// the first lesson of the page, a deep-linked step, another lesson from the column, Back — and
// the Play button shows «Пауза» while it plays. With `prefers-reduced-motion: reduce` it opens
// paused, and Play still plays. The real clock runs here: a step of the lesson takes 2.4 s.
import type { Page } from '@playwright/test';
import { expect, test } from '../support';

/** The lesson's steps are known (the status says «из N»): autoplay has decided by then. */
async function loaded(page: Page, step: number): Promise<void> {
  await expect(page.getByTestId('player-status')).toHaveText(
    new RegExp(`^Шаг ${String(step)} из \\d+$`),
  );
}

async function playing(page: Page, on: boolean): Promise<void> {
  const play = page.getByTestId('player-play');
  await expect(play).toHaveAttribute('data-playing', String(on));
  await expect(play).toHaveText(on ? 'Пауза' : 'Пуск');
}

test.describe('autoplay', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the lesson plays as soon as it opens and moves on by itself', async ({ page }) => {
    await page.goto('/ru/lesson/B1');
    await loaded(page, 1);
    await playing(page, true);
    await loaded(page, 2);
    // Pause stops it where it is.
    await page.getByTestId('player-play').click();
    await playing(page, false);
  });

  test('a deep link plays from its own step', async ({ page }) => {
    await page.goto('/ru/lesson/B1#step-3');
    await loaded(page, 3);
    await playing(page, true);
    await loaded(page, 4);
  });

  test('another lesson from the column plays, after a pause too; so does Back', async ({
    page,
  }) => {
    await page.goto('/ru/lesson/B1');
    await loaded(page, 1);
    await page.getByTestId('player-play').click();
    await playing(page, false);
    await page.locator('[data-testid="side-lesson"][data-topic="C1"] a').click();
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'C1');
    await playing(page, true);
    await page.getByTestId('player-play').click();
    await playing(page, false);
    await page.goBack();
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'B1');
    await playing(page, true);
  });

  test('not with reduced motion: the lesson opens paused, Play still plays', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/ru/lesson/B1');
    await loaded(page, 1);
    await playing(page, false);
    await page.locator('[data-testid="side-lesson"][data-topic="C1"] a').click();
    await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', 'C1');
    await loaded(page, 1);
    await playing(page, false);
    await page.getByTestId('player-play').click();
    await playing(page, true);
  });
});
