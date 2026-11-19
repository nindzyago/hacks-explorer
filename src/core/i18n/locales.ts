/**
 * Completeness of the site languages (M2.3 E3, K94, scenario S9): every language of
 * content/locales/languages.md has every lesson, every interface string and the glossary. A
 * missing translation is an error that names the lesson, the key or the file; the gate is red.
 *
 * Also checks every ui.md, on the site or not, against the Russian one: the same keys and in each
 * string the same `{values}`. Glossary terms are compared by src/core/glossary/check.ts; the
 * glossary of a site language is required there (`siteLanguages`). Build time only.
 */
import { glossaryLanguages } from '../glossary/words';
import { BASE_LANGUAGE, knownLanguages } from '../lesson/headings';
import { createReporter, capReported, START } from '../lesson/report';
import type { LessonError } from '../lesson/types';
import { parseLanguages, type SiteLanguage } from './languages-file';
import { parseUiFile, uiPath, type UiFile } from './ui-file';

const LESSON_PATH = /^content\/lessons\/([A-Za-z][0-9]{1,3})\/([a-z]{2,3})\.md$/;

export interface LocalesInput {
  /** content/locales/languages.md; null when the file is missing. */
  readonly languages: { readonly text: string } | null;
  /** Every content/locales/<lang>/ui.md. */
  readonly ui: readonly { readonly path: string; readonly text: string }[];
  /** Paths of all lesson files: which lesson exists in which language. */
  readonly lessonPaths: readonly string[];
}

/** The interface strings of one language: key → text. */
export type UiStrings = Readonly<Record<string, string>>;

export interface LocalesResult {
  /** The site languages, base first; empty when languages.md has errors. */
  readonly languages: readonly SiteLanguage[];
  /** The strings of each site language. Complete when `errors` is empty. */
  readonly strings: Readonly<Record<string, UiStrings>>;
  readonly errors: readonly LessonError[];
}

function compareUi(base: UiFile, other: UiFile): LessonError[] {
  const reporter = createReporter(other.path);
  for (const [key, entry] of base.entries) {
    const mine = other.entries.get(key);
    if (mine === undefined) {
      reporter.add(
        START,
        key,
        'missing-key',
        `missing key ${key} (${base.path}:${String(entry.line)}): every site language has every string (K94)`,
      );
      continue;
    }
    if (mine.placeholders.join() !== entry.placeholders.join()) {
      const list = (p: readonly string[]) =>
        p.length === 0 ? 'none' : p.map((n) => `{${n}}`).join(', ');
      reporter.add(
        { line: mine.line, column: 1 },
        key,
        'translation-mismatch',
        `${key} has ${list(mine.placeholders)} here but ${list(entry.placeholders)} in ${base.path}`,
      );
    }
  }
  for (const [key, entry] of other.entries) {
    if (!base.entries.has(key)) {
      reporter.add(
        { line: entry.line, column: 1 },
        key,
        'unknown-key',
        `${key} is not in ${base.path}: a new string is added to the Russian file first`,
      );
    }
  }
  return capReported(reporter);
}

export function checkLocales(input: LocalesInput): LocalesResult {
  const errors: LessonError[] = [];
  const parsedLanguages = parseLanguages(input.languages?.text ?? null);
  if (!parsedLanguages.ok) errors.push(...parsedLanguages.errors);
  const languages = parsedLanguages.ok ? parsedLanguages.languages : [];

  const files = new Map<string, UiFile>();
  for (const f of input.ui) {
    const parsed = parseUiFile(f.path, f.text);
    if (!parsed.ok) errors.push(...parsed.errors);
    else files.set(parsed.file.language, parsed.file);
  }
  const base = files.get(BASE_LANGUAGE);
  const baseParsed = input.ui.some((f) => f.path === uiPath(BASE_LANGUAGE));
  if (base === undefined && !baseParsed) {
    const reporter = createReporter(uiPath(BASE_LANGUAGE));
    reporter.add(
      START,
      '',
      'missing-ui',
      'the Russian interface strings are the base of all others',
    );
    errors.push(...reporter.errors);
  }
  if (base !== undefined) {
    for (const file of files.values()) {
      if (file.language !== BASE_LANGUAGE) errors.push(...compareUi(base, file));
    }
  }

  // Which lesson exists in which language.
  const lessons = new Map<string, Set<string>>();
  for (const path of input.lessonPaths) {
    const m = LESSON_PATH.exec(path);
    if (m === null) continue;
    const id = m[1] ?? '';
    const set = lessons.get(id) ?? new Set<string>();
    set.add(m[2] ?? '');
    lessons.set(id, set);
  }

  const known = new Set(knownLanguages());
  const glossaryKnown = new Set(glossaryLanguages());
  for (const { code } of languages) {
    if (!known.has(code) || !glossaryKnown.has(code)) {
      const reporter = createReporter('content/locales/languages.md');
      reporter.add(
        START,
        code,
        'unknown-language',
        `${code} needs its lesson headings (src/core/lesson/headings.ts) and glossary words (src/core/glossary/words.ts)`,
      );
      errors.push(...reporter.errors);
    }
    if (
      code !== BASE_LANGUAGE &&
      !files.has(code) &&
      !input.ui.some((f) => f.path === uiPath(code))
    ) {
      const reporter = createReporter(uiPath(code));
      reporter.add(
        START,
        '',
        'missing-ui',
        `${code} is a site language: add ${uiPath(code)} with every key of ${uiPath(BASE_LANGUAGE)} (K94)`,
      );
      errors.push(...reporter.errors);
    }
    for (const [id, has] of [...lessons].sort(([a], [b]) => a.localeCompare(b))) {
      if (has.has(code)) continue;
      const reporter = createReporter(`content/lessons/${id}/${code}.md`);
      reporter.add(
        START,
        '',
        'missing-translation',
        `lesson ${id} has no ${code}.md: every site language has every lesson (K94)`,
      );
      errors.push(...reporter.errors);
    }
  }

  const strings: Record<string, UiStrings> = {};
  if (errors.length === 0) {
    for (const { code } of languages) {
      const file = files.get(code);
      if (file === undefined) continue;
      strings[code] = Object.freeze(
        Object.fromEntries([...file.entries].map(([key, entry]) => [key, entry.text])),
      );
    }
  }
  return { languages, strings, errors };
}
