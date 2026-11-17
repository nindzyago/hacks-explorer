// ESLint rules behind the invariant "Время подменяемо: анимация идёт от часов плеера, а не от
// системных" (AGENTS.md, decision K17). Site code takes time from src/core/clock.ts; system
// time, timers, frames, browser animations and randomness are allowed in one file only, the
// real-time driver. Used by eslint.config.js; tested by scripts/timing-lint.test.mjs.
// What these rules cannot see is listed in src/time/README.md.

/** The only site file these rules do not apply to. */
export const REAL_TIME_DRIVER = 'src/time/real-time-driver.ts';

const WHY =
  'Site code runs from the player clock (src/core/clock.ts), so that a scenario repeats ' +
  `exactly; system time, timers and randomness live only in ${REAL_TIME_DRIVER}.`;

const GLOBALS = [
  'Date',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestIdleCallback',
  'Animation',
  'KeyframeEffect',
  'DocumentTimeline',
];
const GLOBAL_OBJECTS = ['window', 'globalThis', 'self'];
/** Reached through `window.` and the like, these would slip past the rules for the bare names. */
const VIA_GLOBAL_OBJECT = [...GLOBALS, 'Math', 'crypto'];
const SVELTE_WALL_TIME = ['svelte/motion', 'svelte/transition', 'svelte/animate'];
const DYNAMIC_IMPORT = '^svelte\\/(motion|transition|animate|reactivity)$';

const timingRules = {
  'no-restricted-globals': ['error', ...GLOBALS.map((name) => ({ name, message: WHY }))],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: WHY },
    { object: 'crypto', property: 'getRandomValues', message: WHY },
    { object: 'crypto', property: 'randomUUID', message: WHY },
    { object: 'document', property: 'timeline', message: WHY },
    // Web Animations on any element.
    { property: 'animate', message: WHY },
    { property: 'getAnimations', message: WHY },
    ...GLOBAL_OBJECTS.flatMap((object) =>
      VIA_GLOBAL_OBJECT.map((property) => ({ object, property, message: WHY })),
    ),
  ],
  'no-restricted-imports': [
    'error',
    {
      paths: [
        ...SVELTE_WALL_TIME.map((name) => ({ name, message: WHY })),
        // The rest of svelte/reactivity (SvelteMap, SvelteSet…) is fine.
        { name: 'svelte/reactivity', importNames: ['SvelteDate'], message: WHY },
      ],
    },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: `ImportExpression[source.value=/${DYNAMIC_IMPORT}/]`, message: WHY },
    {
      selector: `ImportExpression > TemplateLiteral > TemplateElement[value.raw=/${DYNAMIC_IMPORT}/]`,
      message: WHY,
    },
    {
      selector: "MemberExpression[property.name='timeline'][object.property.name='document']",
      message: WHY,
    },
  ],
};

/** One block of the ESLint config: every code file of the site except the driver and tests. */
export const timingConfig = {
  files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.mjs', 'src/**/*.cjs', 'src/**/*.svelte'],
  // Tests are not site code: they may build a Date as hostile input.
  ignores: [REAL_TIME_DRIVER, 'src/**/*.test.*'],
  // An exception is made here, in the config, where a reviewer sees it — not by a comment.
  linterOptions: { noInlineConfig: true },
  rules: timingRules,
};
