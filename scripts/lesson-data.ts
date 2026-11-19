// Vite plugin: the lesson data of the site (design M1.1 E11, decision K37). Build time only.
//
// Reads content/ (scripts/content-files.mjs), checks it (src/core/lesson, `checkContent`, the
// glossaries, and M2.3: the site languages are complete, K94) and
//   - `vite build`: fails on any error, printing `file:line:column: message` per line; emits
//     `data/catalog.json` and `data/lessons/<id>.<lang>.<hash>.json` per lesson per site language;
//   - `vite` (dev): serves the same files from memory, built afresh on each request; a broken
//     lesson answers 500 with the messages, the dev server keeps running.
// The site fetches these files (src/services/catalog) and never parses Markdown (K31).
// The interface strings of the site languages are a module, `virtual:site-locales` (K105): a few
// KB, needed before the first paint, so they are bundled rather than fetched.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { ContentFile } from '../src/core/lesson/check';
import { checkContent, formatError } from '../src/core/lesson/check';
import type { SiteCatalog, SiteCatalogEntry, SiteLesson } from '../src/core/lesson/site';
import {
  CATALOG_FILE,
  MAX_LESSON_FILE_BYTES,
  SITE_FORMAT,
  lessonFile,
  toSiteLesson,
} from '../src/core/lesson/site';
import { glossaryMatcher, linkLessonTerms, toSiteGlossary } from '../src/core/glossary/build';
import { checkGlossaries } from '../src/core/glossary/check';
import type { Matcher } from '../src/core/glossary/match';
import { MAX_GLOSSARY_FILE_BYTES, glossaryFile } from '../src/core/glossary/site';
import { checkLocales } from '../src/core/i18n/locales';
import type { SiteLanguage } from '../src/core/i18n/languages-file';
import { ROOT, readContent } from './content-files.mjs';

export interface DataFile {
  /** Path in the built site, `data/…`. */
  readonly path: string;
  readonly text: string;
}

/** What `virtual:site-locales` exports: the site languages and their interface strings. */
export interface SiteLocalesData {
  readonly languages: readonly SiteLanguage[];
  readonly strings: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export type LessonDataResult =
  | { readonly ok: true; readonly files: readonly DataFile[]; readonly locales: SiteLocalesData }
  | { readonly ok: false; readonly errors: readonly string[] };

export const LOCALES_MODULE = 'virtual:site-locales';
const RESOLVED_LOCALES_MODULE = `\0${LOCALES_MODULE}`;

const BASE_LANGUAGE = 'ru';

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * The data files of all content, or the errors as `file:line:column: message`. The glossaries
 * (M2.4) are checked against the lessons; their terms are linked in lesson text and each
 * language's glossary is written to `data/glossary/<lang>.json`. M2.3 (K94): every site language
 * (content/locales/languages.md) has every lesson, every interface string and the glossary; only
 * site languages are written, a language in preparation is checked but not shipped.
 */
export function buildLessonData(content: {
  readonly lessons: readonly ContentFile[];
  readonly sources: ContentFile;
  readonly glossaries: readonly ContentFile[];
  readonly ui: readonly ContentFile[];
  readonly languages: ContentFile | null;
}): LessonDataResult {
  const checked = checkContent(content.lessons, content.sources);
  const lessonPaths = content.lessons.map((f) => f.path);
  const locales = checkLocales({ languages: content.languages, ui: content.ui, lessonPaths });
  const onSite = new Set(locales.languages.map((l) => l.code));
  const glossaries = checkGlossaries(content.glossaries, {
    lessons: checked.lessons,
    lessonPaths,
    siteLanguages: [...onSite],
  });
  const problems = [...checked.errors, ...glossaries.errors, ...locales.errors];
  if (problems.length > 0) return { ok: false, errors: problems.map(formatError) };

  const errors: string[] = [];
  const files: DataFile[] = [];
  const matchers = new Map<string, Matcher>(
    glossaries.glossaries.map((g) => [g.language, glossaryMatcher(g)]),
  );
  const entries = new Map<string, { first: SiteLesson; lessons: SiteLesson[]; hashes: string[] }>();
  for (const lesson of checked.lessons) {
    if (!onSite.has(lesson.language)) continue;
    const plain = toSiteLesson(lesson);
    const matcher = matchers.get(plain.language);
    const site = matcher === undefined ? plain : linkLessonTerms(plain, matcher);
    const text = JSON.stringify(site);
    const bytes = byteLength(text);
    if (bytes > MAX_LESSON_FILE_BYTES) {
      errors.push(
        `content/lessons/${site.id}/${site.language}.md:1:1: the site data of this lesson is ${String(bytes)} bytes; at most ${String(MAX_LESSON_FILE_BYTES)} (plan/architecture.md §6): shorten the texts or split the lesson`,
      );
      continue;
    }
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 8);
    files.push({ path: lessonFile(site.id, site.language, hash), text });
    const entry = entries.get(site.id) ?? { first: site, lessons: [], hashes: [] };
    entry.lessons.push(site);
    entry.hashes.push(hash);
    entries.set(site.id, entry);
  }
  if (errors.length > 0) return { ok: false, errors };

  const lessons: SiteCatalogEntry[] = [...entries.values()].map(({ first, lessons, hashes }) => {
    const translations = lessons.map((l, i) => ({
      language: l.language,
      title: l.title,
      hash: hashes[i] ?? '',
    }));
    // The base language first, then the others by name.
    translations.sort((a, b) =>
      a.language === BASE_LANGUAGE
        ? -1
        : b.language === BASE_LANGUAGE
          ? 1
          : a.language.localeCompare(b.language),
    );
    return { id: first.id, section: first.section, wave: first.wave, translations };
  });
  const catalog: SiteCatalog = { format: SITE_FORMAT, lessons };
  files.unshift({ path: CATALOG_FILE, text: JSON.stringify(catalog) });

  for (const glossary of glossaries.glossaries) {
    if (!onSite.has(glossary.language)) continue;
    const titles = new Map(
      checked.lessons.filter((l) => l.language === glossary.language).map((l) => [l.id, l.title]),
    );
    const text = JSON.stringify(toSiteGlossary(glossary, titles));
    const bytes = byteLength(text);
    if (bytes > MAX_GLOSSARY_FILE_BYTES) {
      errors.push(
        `content/locales/${glossary.language}/glossary.md:1:1: the site data of this glossary is ${String(bytes)} bytes; at most ${String(MAX_GLOSSARY_FILE_BYTES)}: shorten the definitions`,
      );
      continue;
    }
    files.push({ path: glossaryFile(glossary.language), text });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, files, locales: { languages: locales.languages, strings: locales.strings } };
}

export interface LessonDataOptions {
  /** The folder that holds `content/`; the repository root by default. */
  readonly contentRoot?: string;
  /**
   * The folder whose `content/locales/<lang>/ui.md` give the interface strings; `contentRoot` by
   * default (a build can take its lessons from one folder and the strings from another).
   */
  readonly uiRoot?: string;
}

export function lessonData(options: LessonDataOptions = {}): Plugin {
  const read = () => {
    const content = readContent(options.contentRoot);
    return options.uiRoot === undefined
      ? content
      : { ...content, ui: readContent(options.uiRoot).ui };
  };
  const build = (): LessonDataResult => buildLessonData(read());
  let built: readonly DataFile[] = [];
  let locales: SiteLocalesData | null = null;
  let command: 'build' | 'serve' = 'build';
  return {
    name: 'hacks-explorer:lesson-data',

    configResolved(config) {
      command = config.command;
    },

    buildStart() {
      // The dev server builds on request (configureServer), so a broken lesson does not stop it.
      if (command !== 'build') return;
      const result = build();
      if (!result.ok) {
        this.error(`lesson content has errors:\n${result.errors.join('\n')}`);
      }
      built = result.files;
      locales = result.locales;
    },

    resolveId(id) {
      return id === LOCALES_MODULE ? RESOLVED_LOCALES_MODULE : null;
    },

    load(id) {
      if (id !== RESOLVED_LOCALES_MODULE) return null;
      // The dev server reads the files again for each load; a change to a ui.md reloads it.
      let data = locales;
      if (command !== 'build' || data === null) {
        const result = build();
        if (!result.ok) this.error(`lesson content has errors:\n${result.errors.join('\n')}`);
        data = result.locales;
      }
      const uiRoot = options.uiRoot ?? options.contentRoot ?? ROOT;
      for (const file of read().ui) this.addWatchFile(join(uiRoot, file.path));
      return `export default ${JSON.stringify(data)};`;
    },

    generateBundle() {
      for (const file of built) {
        this.emitFile({ type: 'asset', fileName: file.path, source: file.text });
      }
    },

    configureServer(server) {
      const base = server.config.base;
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0] ?? '';
        if (!path.startsWith(`${base}data/`)) {
          next();
          return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET, HEAD');
          response.end();
          return;
        }
        const result = build();
        if (!result.ok) {
          const text = result.errors.join('\n');
          server.config.logger.error(`lesson content has errors:\n${text}`);
          response.statusCode = 500;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(text);
          return;
        }
        const file = result.files.find((f) => `${base}${f.path}` === path);
        if (file === undefined) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(file.text);
      });
    },
  };
}
