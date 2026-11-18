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
      page.on('requestfailed', (request) => {
        const why = request.failure()?.errorText ?? 'unknown';
        problems.push(`request failed: ${request.url()} (${why})`);
      });
      await use(problems);
      expect(problems, 'the page reported problems').toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Opens a page of the e2e build and waits for the application, the control channel and the
 * lesson scene (M1.2a: the page shows lesson B1).
 */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('app')).toBeVisible();
  await page.waitForFunction(() => window.__app !== undefined);
  await expect(page.getByTestId('scene')).toBeVisible();
}

/**
 * Waits until the scene looks final: the fonts it uses are loaded and every icon is decoded.
 * Call before a screenshot that is compared byte for byte.
 */
export async function sceneReady(page: Page): Promise<void> {
  await expect(page.getByTestId('scene')).toBeVisible();
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 13px Onest', 'Сайт'),
      document.fonts.load('400 13px Onest', 'Site'),
      document.fonts.load('400 11px "JetBrains Mono"', 'Сайт'),
      document.fonts.load('400 11px "JetBrains Mono"', 'Site'),
    ]);
    await document.fonts.ready;
    const hrefs = Array.from(document.querySelectorAll('[data-testid="scene"] image')).map(
      (image) => image.getAttribute('href') ?? '',
    );
    await Promise.all(
      hrefs.map((href) => {
        const image = new Image();
        image.src = href;
        return image.decode();
      }),
    );
  });
  // Two animation frames: the decoded icons and the fonts are painted.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

/** Width and height from the header of a PNG file; throws when `file` is not a PNG. */
export function pngSize(file: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.length < 24 || !file.subarray(0, 8).equals(signature)) throw new Error('not a PNG');
  if (file.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error('PNG without IHDR');
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}
