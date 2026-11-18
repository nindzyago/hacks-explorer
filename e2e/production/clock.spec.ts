// M0.4: the production build has no clock readout (it is a development aid) and still works
// with the real-time driver running.
import { expect, sceneReady, test } from '../support';

test('the production build does not show the clock readout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app')).toBeVisible();
  await sceneReady(page);
  await expect(page.getByTestId('clock-readout')).toHaveCount(0);
  const first = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  await page.waitForTimeout(300);
  const later = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  expect(later.equals(first), 'nothing on the page depends on wall time').toBe(true);
});
