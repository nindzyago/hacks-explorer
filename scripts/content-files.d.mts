// Types of content-files.mjs for the TypeScript that imports it (scripts/lesson-data.ts).
export declare const ROOT: string;
export declare function readContent(root?: string): {
  lessons: { path: string; text: string }[];
  sources: { path: string; text: string };
  /** content/locales/<lang>/glossary.md (M2.4). */
  glossaries: { path: string; text: string }[];
  /** content/locales/<lang>/ui.md (M2.3). */
  ui: { path: string; text: string }[];
  /** content/locales/languages.md (M2.3, K94), null when missing. */
  languages: { path: string; text: string } | null;
};
