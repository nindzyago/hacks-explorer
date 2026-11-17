// Acceptance for the M0.4 guard: site code outside the real-time driver cannot read system time,
// schedule timers or use randomness, so animation can only run from the player clock.
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import globals from 'globals';
import ts from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { REAL_TIME_DRIVER, timingRules } from './timing-rules.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Only the timing rules, without type information: fast, and the file need not exist. */
const rulesOnly = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: ts.parser, globals: { ...globals.browser } },
      rules: timingRules,
    },
  ],
});

async function problemsOf(code) {
  const [result] = await rulesOnly.lintText(code, { filePath: 'src/ui/planted.ts' });
  return result.messages.map((m) => `${m.ruleId}: ${m.message}`);
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
    ['crypto.getRandomValues', 'crypto.getRandomValues(new Uint8Array(4));'],
    ['crypto.randomUUID', 'const id = crypto.randomUUID();'],
    ['svelte/motion', "import { tweened } from 'svelte/motion';\nexport const t = tweened(0);"],
    ['svelte/transition', "import { fade } from 'svelte/transition';\nexport const f = fade;"],
    ['svelte/animate', "import { flip } from 'svelte/animate';\nexport const f = flip;"],
  ])('rejects %s', async (_name, code) => {
    const problems = await problemsOf(code);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^no-restricted-(globals|properties|imports): /);
    expect(problems[0]).toContain('player clock');
  });

  it('accepts code that takes time from the player clock', async () => {
    const code = [
      "import { createClock } from '../core/clock';",
      'const clock = createClock();',
      'const date = { now: () => clock.now() };',
      'function setTimeout(ms: number): number { return ms; }',
      'export const t = date.now() + Math.floor(1.5) + setTimeout(1);',
      '// Date.now() and Math.random() in a comment or in "Date.now()" text are fine',
      'export const text = "performance.now()";',
    ].join('\n');
    expect(await problemsOf(code)).toEqual([]);
  });

  it('is switched on for all site code except the real-time driver and tests', async () => {
    const project = new ESLint({ cwd: root });
    const names = Object.keys(timingRules);
    expect(names).toEqual([
      'no-restricted-globals',
      'no-restricted-properties',
      'no-restricted-imports',
    ]);
    for (const path of [
      'src/main.ts',
      'src/core/clock.ts',
      'src/commands/clock.ts',
      'src/ui/App.svelte',
      'src/scene/Stage.svelte',
      'src/scene/state.svelte.ts',
      'src/time/other.ts',
    ]) {
      const config = await project.calculateConfigForFile(path);
      for (const name of names) {
        expect(config.rules?.[name], `${name} in ${path}`).toEqual([
          2,
          ...timingRules[name].slice(1),
        ]);
      }
    }
    expect(REAL_TIME_DRIVER).toBe('src/time/real-time-driver.ts');
    const driver = await project.calculateConfigForFile(REAL_TIME_DRIVER);
    const test = await project.calculateConfigForFile('src/core/clock.test.ts');
    for (const name of names) {
      expect(driver.rules?.[name]).toBeUndefined();
      expect(test.rules?.[name]).toBeUndefined();
    }
  });
});
