// The interface strings of the site languages, bundled by the build (scripts/lesson-data.ts,
// M2.3, K105). Typed `unknown`: src/services/i18n `readLocales` checks it like any other input.
declare module 'virtual:site-locales' {
  const locales: unknown;
  export default locales;
}
