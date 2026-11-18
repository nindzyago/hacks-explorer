// M0.4, M1.2b: the production build has no clock readout (it was a development aid, removed in
// M1.2b) and runs the scene from the real-time driver: the message of step 1 travels to its
// receiver and then the page stays still.
import { expect, sceneReady, test } from '../support';

test('the production build moves the message by the live clock, then rests', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app')).toBeVisible();
  await sceneReady(page);
  await expect(page.getByTestId('clock-readout')).toHaveCount(0);
  await expect(page.getByTestId('message')).toHaveAttribute('data-arrived', 'true');
  const first = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  await page.waitForTimeout(300);
  const later = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  expect(later.equals(first), 'an arrived message stays where it is').toBe(true);
});
