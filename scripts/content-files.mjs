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
 * Every file under content/lessons and content/sources.md, as `{ path, text }` with paths
 * relative to the repository root and forward slashes.
 * @param {string} [root]
 * @returns {{ lessons: { path: string, text: string }[], sources: { path: string, text: string } }}
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
  return { lessons, sources };
}
