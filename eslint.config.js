import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import { REAL_TIME_DRIVER, timingRules } from './scripts/timing-rules.mjs';
import svelteConfig from './svelte.config.js';

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'prototype/', 'reference/'] },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
  },
  {
    // Time is replaceable: site code runs from the player clock, not from system time.
    // Tests are not site code: they may build a Date as hostile input.
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: [REAL_TIME_DRIVER, 'src/**/*.test.ts'],
    rules: timingRules,
  },
  {
    // Tooling scripts and configs are plain JavaScript run by Node.
    files: ['**/*.js', '**/*.mjs'],
    extends: [ts.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
);
