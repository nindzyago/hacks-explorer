// End-to-end tests (`npm run e2e`, part of `npm run gate`): headless Chromium against the built
// site, served by scripts/serve-static.mjs the way the production host serves it.
//   e2e         the e2e build (`dist-e2e/`, has `window.__app`)  e2e/*.spec.ts
//   production  the production build (`dist/`, must not have it)   e2e/production/*.spec.ts
import { availableParallelism } from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { LESSONS } from './e2e/lessons';
import { parseShard, shardFilter } from './scripts/e2e-shards.mjs';

// Own ports per worktree: E2E_PORT=42xx npm run e2e
const port = Number(process.env['E2E_PORT'] ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65533) {
  throw new Error('E2E_PORT must be a port number between 1024 and 65533');
}
// CI7: how many browsers at once. E2E_WORKERS=n sets it; on CI one per core (the runner does
// nothing else while the tests run); on a laptop Playwright's default, half the cores.
function workers(): { workers?: number } {
  const asked = process.env['E2E_WORKERS'];
  if (asked !== undefined && asked !== '') {
    const n = Number(asked);
    if (!Number.isInteger(n) || n < 1 || n > 64) {
      throw new Error('E2E_WORKERS must be a whole number from 1 to 64');
    }
    return { workers: n };
  }
  return process.env['CI'] === undefined ? {} : { workers: Math.max(1, availableParallelism()) };
}
// CI7: E2E_SHARD=k/n runs the k-th of n parts of the tests, a part being every n-th lesson
// (scripts/e2e-shards.mjs); CI runs the parts as parallel jobs.
const shard = parseShard(process.env['E2E_SHARD']);
const part = shard === null ? {} : shardFilter(LESSONS, shard);
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
  ...workers(),
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  use: { headless: true, locale: 'ru-RU', timezoneId: 'UTC', colorScheme: 'light' },
  projects: [
    {
      name: 'e2e',
      testIgnore: ['production/**'],
      ...part,
      use: { ...chromium, baseURL: origin(port) },
    },
    {
      name: 'production',
      testMatch: 'production/**/*.spec.ts',
      ...part,
      use: { ...chromium, baseURL: origin(port + 1) },
    },
  ],
  webServer: [server('dist-e2e', port), server('dist', port + 1)],
});
