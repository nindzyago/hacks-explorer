/**
 * Checks the catalogs of all languages together (M2.1 E3, K111):
 *  - each file on its own (file.ts);
 *  - the Russian catalog is the base; every other one has the same sections and the same topics
 *    in the same order (the names are translations);
 *  - every lesson of content/lessons is a topic of the catalog of its language, in its section;
 *  - every site language has a catalog (K94).
 * Errors name the file and the line; the gate is red. Build time only.
 */
import { BASE_LANGUAGE } from '../lesson/headings';
import { createReporter, capReported, START } from '../lesson/report';
import type { LessonError } from '../lesson/types';
import { catalogPath, parseCatalogFile, type CatalogFile } from './file';

export interface CatalogLesson {
  readonly id: string;
  readonly section: string;
  readonly language: string;
}

export interface CatalogContext {
  /** The lessons that passed the lesson checker. */
  readonly lessons: readonly CatalogLesson[];
  /** Paths of all lesson files, checked or not: a lesson folder must be in the catalog. */
  readonly lessonPaths: readonly string[];
  /** content/locales/languages.md: each of them needs a catalog. */
  readonly siteLanguages: readonly string[];
}

export interface CatalogsResult {
  /** Every catalog that parsed, by language. Complete when `errors` is empty. */
  readonly catalogs: ReadonlyMap<string, CatalogFile>;
  readonly errors: readonly LessonError[];
}

const LESSON_PATH = /^content\/lessons\/([^/]+)\/([a-z]{2,3})\.md$/;

function compare(base: CatalogFile, other: CatalogFile): LessonError[] {
  const reporter = createReporter(other.path);
  const baseIds = base.sections.flatMap((s) => s.topics.map((t) => t.id));
  const ids = other.sections.flatMap((s) => s.topics.map((t) => t.id));
  const baseSections = base.sections.map((s) => s.id).join(' ');
  const sections = other.sections.map((s) => s.id).join(' ');
  if (baseSections !== sections) {
    reporter.add(
      START,
      '',
      'translation-mismatch',
      `the sections are ${sections || 'none'} here but ${baseSections} in ${base.path}`,
    );
  }
  const have = new Set(ids);
  const wanted = new Set(baseIds);
  for (const section of base.sections) {
    for (const topic of section.topics) {
      if (!have.has(topic.id)) {
        reporter.add(
          START,
          topic.id,
          'missing-translation',
          `missing topic ${topic.id} (${base.path}:${String(topic.line)}): a translation has every topic`,
        );
      }
    }
  }
  for (const section of other.sections) {
    for (const topic of section.topics) {
      if (!wanted.has(topic.id)) {
        reporter.add(
          { line: topic.line, column: 1 },
          topic.id,
          'unknown-id',
          `${topic.id} is not in ${base.path}: a new topic is added to the Russian catalog first`,
        );
      }
    }
  }
  if (reporter.total() === 0 && baseIds.join(' ') !== ids.join(' ')) {
    reporter.add(START, '', 'section-order', `the topics go in the order of ${base.path}`);
  }
  return capReported(reporter);
}

export function checkCatalogs(
  files: readonly { readonly path: string; readonly text: string }[],
  context: CatalogContext,
): CatalogsResult {
  const errors: LessonError[] = [];
  const catalogs = new Map<string, CatalogFile>();
  const broken = new Set<string>();
  for (const f of files) {
    const parsed = parseCatalogFile(f.path, f.text);
    if (parsed.ok) catalogs.set(parsed.file.language, parsed.file);
    else {
      errors.push(...parsed.errors);
      broken.add(f.path);
    }
  }

  const base = catalogs.get(BASE_LANGUAGE);
  if (base === undefined && !broken.has(catalogPath(BASE_LANGUAGE))) {
    const reporter = createReporter(catalogPath(BASE_LANGUAGE));
    reporter.add(START, '', 'missing-base', 'the Russian catalog lists every topic of the site');
    errors.push(...reporter.errors);
  }
  if (base !== undefined) {
    for (const file of catalogs.values()) {
      if (file.language !== BASE_LANGUAGE) errors.push(...compare(base, file));
    }
  }

  for (const code of context.siteLanguages) {
    const path = catalogPath(code);
    // A missing base catalog is reported above.
    if (code === BASE_LANGUAGE || catalogs.has(code) || broken.has(path)) continue;
    const reporter = createReporter(path);
    reporter.add(
      START,
      '',
      'missing-translation',
      `${code} is a site language: add ${path} with every topic of ${catalogPath(BASE_LANGUAGE)} (K94)`,
    );
    errors.push(...reporter.errors);
  }

  // Every lesson folder is a topic of the base catalog.
  if (base !== undefined) {
    const topics = new Set(base.sections.flatMap((s) => s.topics.map((t) => t.id)));
    const folders = new Set<string>();
    for (const path of context.lessonPaths) {
      const m = LESSON_PATH.exec(path);
      if (m !== null) folders.add(m[1] ?? '');
    }
    for (const id of [...folders].sort()) {
      if (topics.has(id)) continue;
      const reporter = createReporter(`content/lessons/${id}`);
      reporter.add(
        START,
        id,
        'unknown-id',
        `lesson ${id} is not in ${base.path}: every lesson is a topic of the catalog`,
      );
      errors.push(...reporter.errors);
    }
  }

  // A lesson stands in its own section in the catalog of its language.
  for (const lesson of context.lessons) {
    const catalog = catalogs.get(lesson.language) ?? base;
    if (catalog === undefined) continue;
    const section = catalog.sections.find((s) => s.topics.some((t) => t.id === lesson.id));
    if (section !== undefined && section.id !== lesson.section) {
      const reporter = createReporter(`content/lessons/${lesson.id}/${lesson.language}.md`);
      reporter.add(
        START,
        'section',
        'unknown-section',
        `the lesson says section ${lesson.section}, ${catalog.path} has it in section ${section.id}`,
      );
      errors.push(...reporter.errors);
    }
  }
  return { catalogs, errors };
}
