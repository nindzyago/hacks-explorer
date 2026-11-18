// Acceptance for the M0.4 guard: site code outside the real-time driver cannot read system time,
// schedule timers or frames, start browser animations or use randomness, so animation can only
// run from the player clock.
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import globals from 'globals';
import ts from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { LOAD_TIMER, REAL_TIME_DRIVER, timingConfig } from './timing-rules.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Only the timing block, without type information: fast, and the file need not exist. */
const timingOnly = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts', '**/*.js'],
      languageOptions: { parser: ts.parser, globals: { ...globals.browser } },
    },
    timingConfig,
  ],
});

async function problemsOf(code, filePath = 'src/ui/planted.ts') {
  const [result] = await timingOnly.lintText(code, { filePath });
  return result.messages.map((m) => `${String(m.ruleId)}: ${m.message}`);
}

describe('timing rules', () => {
  it.each([
    ['Date.now()', 'const t = Date.now();'],
    ['new Date()', 'const d = new Date();'],
    ['Date()', 'const s = Date();'],
    ['performance.now()', 'const t = performance.now();'],
    ['Math.random()', 'const r = Math.random();'],
    ['setTimeout', 'setTimeout(() => {}, 16);'],
    ['setInterval', 'setInterval(() => {}, 16);'],
    ['requestAnimationFrame', 'requestAnimationFrame(() => {});'],
    ['cancelAnimationFrame', 'cancelAnimationFrame(1);'],
    ['requestIdleCallback', 'requestIdleCallback(() => {});'],
    ['window.setTimeout', 'window.setTimeout(() => {}, 16);'],
    ['window.requestAnimationFrame', 'window.requestAnimationFrame(() => {});'],
    ['globalThis.performance', 'const t = globalThis.performance.now();'],
    ['globalThis.Date', 'const t = globalThis.Date.now();'],
    ['self.setInterval', 'self.setInterval(() => {}, 16);'],
    ['window.Math.random', 'const r = window.Math.random();'],
    ['globalThis.Math.random', 'const r = globalThis.Math.random();'],
    ['crypto.getRandomValues', 'crypto.getRandomValues(new Uint8Array(4));'],
    ['crypto.randomUUID', 'const id = crypto.randomUUID();'],
    ['window.crypto', 'const id = window.crypto.randomUUID();'],
    ['globalThis.crypto', 'globalThis.crypto.getRandomValues(new Uint8Array(4));'],
    ['svelte/motion', "import { tweened } from 'svelte/motion';\nexport const t = tweened(0);"],
    ['svelte/transition', "import { fade } from 'svelte/transition';\nexport const f = fade;"],
    ['svelte/animate', "import { flip } from 'svelte/animate';\nexport const f = flip;"],
    ['import(svelte/transition)', "export const m = import('svelte/transition');"],
    ['import(svelte/motion)', "export const m = import('svelte/motion');"],
    ['import(svelte/animate)', 'export const m = import(`svelte/animate`);'],
    ['import(svelte/reactivity)', "export const m = import('svelte/reactivity');"],
    ['SvelteDate', "import { SvelteDate } from 'svelte/reactivity';\nexport const d = SvelteDate;"],
    [
      'SvelteDate renamed',
      "import { SvelteDate as D } from 'svelte/reactivity';\nexport const d = D;",
    ],
    [
      'svelte/reactivity as a whole',
      "import * as r from 'svelte/reactivity';\nexport const d = r;",
    ],
    ['element.animate', 'export const a = (el: Element) => el.animate([], 100);'],
    ['element.getAnimations', 'export const a = (el: Element) => el.getAnimations();'],
    ['document.timeline', 'export const t = document.timeline;'],
    ['window.document.timeline', 'export const t = window.document.timeline;'],
    ['new Animation', 'export const a = new Animation();'],
    ['new KeyframeEffect', 'export const k = new KeyframeEffect(null, []);'],
    ['new DocumentTimeline', 'export const t = new DocumentTimeline();'],
  ])('rejects %s', async (_name, code) => {
    const problems = await problemsOf(code);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^no-restricted-(globals|properties|imports|syntax): /);
    expect(problems[0]).toContain('player clock');
  });

  it('accepts code that takes time from the player clock', async () => {
    const code = [
      "import { createClock } from '../core/clock';",
      "import { SvelteMap } from 'svelte/reactivity';",
      'const clock = createClock();',
      'const date = { now: () => clock.now() };',
      'function setTimeout(ms: number): number { return ms; }',
      'export const t = date.now() + Math.floor(1.5) + setTimeout(1);',
      '// Date.now() and Math.random() in a comment or in "Date.now()" text are fine',
      'export const text = "performance.now()";',
      'export const lesson = { timeline: [1, 2], random: 3 };',
      'export const steps = lesson.timeline.length + lesson.random;',
      'export const digest = crypto.subtle;',
      'export const map = new SvelteMap<string, number>();',
      "export const later = import('../core/clock');",
    ].join('\n');
    expect(await problemsOf(code)).toEqual([]);
  });

  it('covers plain JavaScript in src as well', async () => {
    for (const path of ['src/ui/planted.js', 'src/scene/state.svelte.js', 'src/core/x.mjs']) {
      const problems = await problemsOf('export const t = Date.now();', path);
      expect(problems, path).toHaveLength(1);
    }
  });

  it('cannot be switched off by a comment in the file', async () => {
    const problems = await problemsOf(
      [
        '/* eslint-disable no-restricted-globals */',
        '// eslint-disable-next-line no-restricted-globals -- just this once',
        'export const t = Date.now();',
      ].join('\n'),
    );
    expect(problems.filter((p) => p.startsWith('no-restricted-globals: '))).toHaveLength(1);
    // The comments themselves are reported too, so `--max-warnings 0` fails on them.
    expect(problems.filter((p) => p.includes('noInlineConfig'))).toHaveLength(2);
  });

  it('is switched on for all site code except the real-time driver and tests', async () => {
    const project = new ESLint({ cwd: root });
    const names = Object.keys(timingConfig.rules);
    expect(names).toEqual([
      'no-restricted-globals',
      'no-restricted-properties',
      'no-restricted-imports',
      'no-restricted-syntax',
    ]);
    for (const path of [
      'src/main.ts',
      'src/core/clock.ts',
      'src/commands/clock.ts',
      'src/ui/App.svelte',
      'src/ui/helper.js',
      'src/scene/Stage.svelte',
      'src/scene/state.svelte.ts',
      'src/scene/state.svelte.js',
      'src/time/other.ts',
    ]) {
      const config = await project.calculateConfigForFile(path);
      for (const name of names) {
        expect(config.rules?.[name], `${name} in ${path}`).toEqual([
          2,
          ...timingConfig.rules[name].slice(1),
        ]);
      }
      expect(config.linterOptions.noInlineConfig, path).toBe(true);
    }
    expect(REAL_TIME_DRIVER).toBe('src/time/real-time-driver.ts');
    expect(LOAD_TIMER).toBe('src/time/load-timer.ts');
    for (const path of [
      REAL_TIME_DRIVER,
      LOAD_TIMER,
      'src/core/clock.test.ts',
      'e2e/determinism.spec.ts',
    ]) {
      const config = await project.calculateConfigForFile(path);
      for (const name of names) expect(config.rules?.[name], path).toBeUndefined();
      expect(config.linterOptions.noInlineConfig, path).not.toBe(true);
      // A disable comment that silences nothing is an error everywhere.
      expect(config.linterOptions.reportUnusedDisableDirectives, path).toBe(2);
    }
  });
});
