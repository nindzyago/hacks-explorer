// Shared by every e2e test. Import `test` and `expect` from here, not from '@playwright/test':
// this `test` fails when the page logs an error, throws, or the browser blocks something
// (a Content-Security-Policy violation is reported as a console error).
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
      page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
      await use(problems);
      expect(problems, 'the page reported problems').toEqual([]);
    },
    { auto: true },
  ],
});

/** Opens a page of the e2e build and waits for the application and the control channel. */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('app')).toBeVisible();
  await page.waitForFunction(() => window.__app !== undefined);
}

/** Width and height from the header of a PNG file; throws when `file` is not a PNG. */
export function pngSize(file: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.length < 24 || !file.subarray(0, 8).equals(signature)) throw new Error('not a PNG');
  if (file.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error('PNG without IHDR');
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}
