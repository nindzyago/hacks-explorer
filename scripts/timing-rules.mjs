// ESLint rules behind the invariant "Время подменяемо: анимация идёт от часов плеера, а не от
// системных" (AGENTS.md). Site code takes time from src/core/clock.ts; system time, timers,
// frames and randomness are allowed in one file only, the real-time driver.
// Used by eslint.config.js; tested by scripts/timing-lint.test.mjs.

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
];
const GLOBAL_OBJECTS = ['window', 'globalThis', 'self'];
const SVELTE_WALL_TIME = ['svelte/motion', 'svelte/transition', 'svelte/animate'];

export const timingRules = {
  'no-restricted-globals': ['error', ...GLOBALS.map((name) => ({ name, message: WHY }))],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: WHY },
    { object: 'crypto', property: 'getRandomValues', message: WHY },
    { object: 'crypto', property: 'randomUUID', message: WHY },
    ...GLOBAL_OBJECTS.flatMap((object) =>
      GLOBALS.map((property) => ({ object, property, message: WHY })),
    ),
  ],
  'no-restricted-imports': [
    'error',
    { paths: SVELTE_WALL_TIME.map((name) => ({ name, message: WHY })) },
  ],
};
