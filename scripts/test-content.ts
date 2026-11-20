// Test helper (CI6): content sets for the tests that build the site data. Building the whole
// real content costs time in proportion to the number of lessons (75 planned), so a test that
// only needs the mechanism (an error message, a dev server, a bundled module) builds a small set
// cut from the real content instead; each test file keeps at least one test on the real content.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { readContent } from './content-files.mjs';

export type Content = ReturnType<typeof readContent>;

const LESSON_PATH = /^content\/lessons\/([^/]+)\//;
const LESSONS_FIELD = / · `lessons` ([^\n]*)$/gm;

/** The id of the lesson a lesson file belongs to, from its path. */
export function lessonIdOf(path: string): string {
  return LESSON_PATH.exec(path)?.[1] ?? '';
}

/**
 * The real content with only the lessons `ids` (every language of each). Glossary terms keep
 * their `lessons` field for those lessons only, so the set stays valid: everything else (the
 * glossaries, interface strings, languages, catalogs, sources) is the real content, unchanged.
 */
export function onlyLessons(content: Content, ids: readonly string[]): Content {
  const keep = new Set(ids);
  const glossaries = content.glossaries.map((f) => ({
    ...f,
    text: f.text.replace(LESSONS_FIELD, (_field, list: string) => {
      const kept = list
        .split(',')
        .map((id) => id.trim())
        .filter((id) => keep.has(id));
      return kept.length === 0 ? '' : ` · \`lessons\` ${kept.join(', ')}`;
    }),
  }));
  return {
    ...content,
    lessons: content.lessons.filter((f) => keep.has(lessonIdOf(f.path))),
    glossaries,
  };
}

/** Every file of `content` under `root`, at its path (content/…), as `readContent(root)` reads it. */
export function writeContent(root: string, content: Content): void {
  const languages = content.languages === null ? [] : [content.languages];
  for (const f of [
    ...content.lessons,
    content.sources,
    ...content.glossaries,
    ...content.ui,
    ...languages,
    ...content.catalogs,
  ]) {
    mkdirSync(join(root, f.path, '..'), { recursive: true });
    writeFileSync(join(root, f.path), f.text);
  }
}
