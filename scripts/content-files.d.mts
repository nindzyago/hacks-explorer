// Types of content-files.mjs for the TypeScript that imports it (scripts/lesson-data.ts).
export declare const ROOT: string;
export declare function readContent(root?: string): {
  lessons: { path: string; text: string }[];
  sources: { path: string; text: string };
};
