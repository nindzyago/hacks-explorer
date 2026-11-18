import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { lessonData } from './scripts/lesson-data';

export default defineConfig({
  plugins: [svelte(), lessonData()],
  build: { target: 'es2022' },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
