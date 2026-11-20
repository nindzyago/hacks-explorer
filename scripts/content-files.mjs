// Reads the lesson content from disk for the checker in src/core/lesson (which never touches the
// file system). Used by the content test (`npm run content`, part of `npm run gate`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (error?.code === 'ENOENT') return out;
    throw error;
  }
  for (const name of names.sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Every file under content/lessons, content/sources.md, the glossaries (every file of
 * `content/locales/<lang>/glossary/`, M2.4 and G17, and an old single `glossary.md` for the
 * checker to name), the interface strings
 * (`content/locales/<lang>/ui.md`, M2.3) and the list of site languages
 * (`content/locales/languages.md`, null when missing) and the catalogs of topics
 * (`content/locales/<lang>/catalog.md`, M2.1b), as `{ path, text }` with paths relative
 * to the repository root and forward slashes.
 * @param {string} [root]
 * @returns {{ lessons: { path: string, text: string }[], sources: { path: string, text: string },
 *             glossaries: { path: string, text: string }[], ui: { path: string, text: string }[],
 *             languages: { path: string, text: string } | null,
 *             catalogs: { path: string, text: string }[] }}
 */
export function readContent(root = ROOT) {
  const toFile = (full) => ({
    path: relative(root, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  });
  const lessons = walk(join(root, 'content', 'lessons'), []).map(toFile);
  const sourcesPath = join(root, 'content', 'sources.md');
  let sources;
  try {
    sources = toFile(sourcesPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    sources = { path: 'content/sources.md', text: '' };
  }
  const locales = walk(join(root, 'content', 'locales'), []).map(toFile);
  const isGlossary = (f) => /^content\/locales\/[^/]+\/glossary(\.md$|\/)/.test(f.path);
  const glossaries = locales.filter(isGlossary);
  // A glossary category may be called `ui` or `catalog`: its file is still the glossary's.
  const others = locales.filter((f) => !isGlossary(f));
  const ui = others.filter((f) => f.path.endsWith('/ui.md'));
  const languages = locales.find((f) => f.path === 'content/locales/languages.md') ?? null;
  const catalogs = others.filter((f) => f.path.endsWith('/catalog.md'));
  return { lessons, sources, glossaries, ui, languages, catalogs };
}
