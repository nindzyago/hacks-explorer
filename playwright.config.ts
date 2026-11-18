// End-to-end tests (`npm run e2e`, part of `npm run gate`): headless Chromium against the built
// site, served by scripts/serve-static.mjs the way the production host serves it.
//   e2e         the e2e build (`dist-e2e/`, has `window.__app`)  e2e/*.spec.ts
//   production  the production build (`dist/`, must not have it)   e2e/production/*.spec.ts
import { defineConfig, devices } from '@playwright/test';

// Own ports per worktree: E2E_PORT=42xx npm run e2e
const port = Number(process.env['E2E_PORT'] ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65534) {
  throw new Error('E2E_PORT must be a port number between 1024 and 65534');
}
const origin = (p: number) => `http://127.0.0.1:${String(p)}`;
const server = (folder: string, p: number) => ({
  command: `node scripts/serve-static.mjs ${folder} ${String(p)}`,
  url: origin(p),
  reuseExistingServer: false,
  timeout: 10_000,
});
const chromium = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  // M1.2b: with partial raster Chromium re-draws only the changed part of a tile, so after a
  // moving message the antialiasing at the edge of that part depends on the paint history and
  // a byte-for-byte screenshot comparison flakes. Full re-raster makes a frame depend on the
  // DOM alone.
  launchOptions: { args: ['--disable-partial-raster'] },
};

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  use: { headless: true, locale: 'ru-RU', timezoneId: 'UTC', colorScheme: 'light' },
  projects: [
    {
      name: 'e2e',
      testIgnore: 'production/**',
      use: { ...chromium, baseURL: origin(port) },
    },
    {
      name: 'production',
      testMatch: 'production/**/*.spec.ts',
      use: { ...chromium, baseURL: origin(port + 1) },
    },
  ],
  webServer: [server('dist-e2e', port), server('dist', port + 1)],
});
