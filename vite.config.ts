import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { lessonData } from './scripts/lesson-data';

// `vite build --mode e2e-i18n` (M2.3, K106): the site with two languages, for scenario S5 until
// the English lessons land (M2.3b). Lessons, glossaries and the language list come from a small
// fixture; the interface strings are the real ones of the repository.
const I18N_FIXTURE = fileURLToPath(new URL('./e2e/fixtures/i18n', import.meta.url));
const REPOSITORY = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    lessonData(mode === 'e2e-i18n' ? { contentRoot: I18N_FIXTURE, uiRoot: REPOSITORY } : {}),
  ],
  build: { target: 'es2022' },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
}));
