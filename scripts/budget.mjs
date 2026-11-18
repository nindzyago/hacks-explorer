#!/usr/bin/env node
// Size budgets of the built site (plan/architecture.md §6), part of `npm run gate` after the
// build. Prints the numbers and fails when a budget is broken:
//   first load   JS that index.html loads (scripts and module preloads), gzip: ≤ 150 KB
//   lesson file  each data/lessons/*.json, as served (bytes, no compression): ≤ 30 KB
// Usage: node scripts/budget.mjs [folder]   (default dist)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const FIRST_LOAD_JS_GZIP = 150 * 1024;
export const LESSON_FILE = 30 * 1024;

const SCRIPT = /<script\b[^>]*\bsrc="([^"]+)"/g;
const PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g;

/** The local JS files index.html loads, as paths inside `folder`. */
export function firstLoadScripts(html) {
  const found = [];
  for (const pattern of [SCRIPT, PRELOAD]) {
    for (const match of html.matchAll(pattern)) {
      const src = match[1] ?? '';
      if (/^[a-z]+:|^\/\//i.test(src)) continue; // another server: not ours to count (L6 forbids it anyway)
      const path = src.replace(/^\.?\//, '');
      if (!found.includes(path)) found.push(path);
    }
  }
  return found;
}

/**
 * @param {string} folder a built site
 * @returns {{ firstLoad: { files: { path: string, gzip: number }[], gzip: number },
 *             lessons: { path: string, bytes: number }[], catalog: number | null,
 *             problems: string[] }}
 */
export function measure(folder) {
  const problems = [];
  const indexPath = join(folder, 'index.html');
  if (!existsSync(indexPath)) {
    return {
      firstLoad: { files: [], gzip: 0 },
      lessons: [],
      catalog: null,
      problems: [`${indexPath}: no such file; build the site first`],
    };
  }
  const files = firstLoadScripts(readFileSync(indexPath, 'utf8')).map((path) => {
    const full = join(folder, path);
    if (!existsSync(full)) {
      problems.push(`index.html loads ${path}, which is not in ${folder}`);
      return { path, gzip: 0 };
    }
    return { path, gzip: gzipSync(readFileSync(full)).length };
  });
  const gzip = files.reduce((sum, f) => sum + f.gzip, 0);
  if (gzip > FIRST_LOAD_JS_GZIP) {
    problems.push(
      `first load: ${String(gzip)} bytes of JS in gzip; the budget is ${String(FIRST_LOAD_JS_GZIP)}`,
    );
  }

  const lessonsDir = join(folder, 'data', 'lessons');
  const lessons = existsSync(lessonsDir)
    ? readdirSync(lessonsDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => ({
          path: `data/lessons/${name}`,
          bytes: readFileSync(join(lessonsDir, name)).length,
        }))
    : [];
  for (const lesson of lessons) {
    if (lesson.bytes > LESSON_FILE) {
      problems.push(
        `${lesson.path}: ${String(lesson.bytes)} bytes; a lesson file is at most ${String(LESSON_FILE)}`,
      );
    }
  }
  const catalogPath = join(folder, 'data', 'catalog.json');
  const catalog = existsSync(catalogPath) ? readFileSync(catalogPath).length : null;
  if (catalog === null)
    problems.push(`${catalogPath}: no catalog; the lesson data plugin did not run`);
  if (lessons.length === 0) problems.push(`${lessonsDir}: no lesson files`);
  return { firstLoad: { files, gzip }, lessons, catalog, problems };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const folder = resolve(root, process.argv[2] ?? 'dist');
  const { firstLoad, lessons, catalog, problems } = measure(folder);
  console.log(`budget: ${folder}`);
  console.log(
    `  first load JS (gzip): ${kb(firstLoad.gzip)} of ${kb(FIRST_LOAD_JS_GZIP)}  [${firstLoad.files.map((f) => `${f.path} ${kb(f.gzip)}`).join(', ')}]`,
  );
  if (catalog !== null) console.log(`  data/catalog.json: ${kb(catalog)}`);
  for (const lesson of lessons) {
    console.log(`  ${lesson.path}: ${kb(lesson.bytes)} of ${kb(LESSON_FILE)}`);
  }
  for (const problem of problems) console.error(`budget: ${problem}`);
  if (problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
