// The production build (`dist/`) works and has no control channel: not as a global, and not
// as text in any file. The interface still runs commands, because it does not use the channel.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../support';

function filesWith(folder: string, text: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    if (readFileSync(path).includes(text)) found.push(path);
  }
  return found;
}

test('the production build has no window.__app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app')).toBeVisible();
  expect(await page.evaluate(() => '__app' in window)).toBe(false);
});

test('no file of the production build mentions __app', () => {
  expect(filesWith('dist', '__app')).toEqual([]);
  // The same search does find it in the e2e build, so an empty answer above means something.
  expect(filesWith('dist-e2e', '__app')).not.toEqual([]);
});

test('the interface works without the channel', async ({ page }) => {
  await page.goto('/');
  // The lesson loads through the site's own loader and the scene draws it (M1.2a).
  await expect(page.getByTestId('participant-attacker')).toBeVisible();
  await expect(page.getByTestId('zone-site')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
});
