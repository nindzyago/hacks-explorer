/**
 * Build-time glue (M2.4, CI3): a checked glossary → its matcher and its site files (an index and
 * chunks of definitions), and a lesson's text with the glossary terms linked. Used by
 * scripts/lesson-data.ts.
 */
import type { SiteLesson } from '../lesson/site';
import { siteBlock } from '../lesson/site';
import type { Matcher } from './match';
import { createMatcher, linkTerms } from './match';
import type {
  SiteGlossary,
  SiteGlossaryCategory,
  SiteGlossaryChunk,
  SiteGlossaryDefinition,
  SiteGlossaryTerm,
} from './site';
import { GLOSSARY_CHUNK_BYTES, GLOSSARY_FORMAT } from './site';
import type { Glossary } from './types';

export function glossaryMatcher(glossary: Glossary): Matcher {
  return createMatcher(glossary.terms);
}

/** A glossary with every term whole: what the build splits into the site files. */
export interface WholeSiteGlossary {
  readonly language: string;
  readonly title: string;
  readonly categories: readonly SiteGlossaryCategory[];
  readonly terms: readonly SiteGlossaryTerm[];
}

/**
 * The glossary as the site shows it. Definitions link the other terms they mention (never their
 * own); related lessons carry their title in the glossary's language (`titles`: id → title), and
 * a lesson without a title in that language is left out.
 */
export function toSiteGlossary(
  glossary: Glossary,
  titles: ReadonlyMap<string, string>,
): WholeSiteGlossary {
  const matcher = glossaryMatcher(glossary);
  return {
    language: glossary.language,
    title: glossary.title,
    categories: glossary.categories.map((c) => ({ id: c.id, label: c.label })),
    terms: glossary.terms.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      definition: linkTerms(t.definition.map(siteBlock), matcher, t.id),
      see: [...t.see],
      lessons: t.lessons.flatMap((id) => {
        const title = titles.get(id);
        return title === undefined ? [] : [{ id, title }];
      }),
    })),
  };
}

export interface SplitGlossary {
  readonly index: SiteGlossary;
  /** The chunk files in index order: their text and the hash the index names them by. */
  readonly chunks: readonly { readonly hash: string; readonly text: string }[];
}

const utf8 = new TextEncoder();

function bytes(text: string): number {
  return utf8.encode(text).length;
}

/**
 * Splits a glossary into the index and chunks of definitions (CI3). Terms keep their order and go
 * into chunks in runs; a chunk is closed before it would pass `chunkBytes` (a single larger term
 * still gets a chunk of its own). `hash` names a chunk by its text (8 hex digits).
 */
export function splitSiteGlossary(
  glossary: WholeSiteGlossary,
  hash: (text: string) => string,
  chunkBytes: number = GLOSSARY_CHUNK_BYTES,
): SplitGlossary {
  const empty = JSON.stringify({ format: GLOSSARY_FORMAT, language: glossary.language, terms: [] });
  const runs: SiteGlossaryDefinition[][] = [];
  let run: SiteGlossaryDefinition[] = [];
  let size = bytes(empty);
  const chunkOf = new Map<string, number>();
  for (const t of glossary.terms) {
    const part: SiteGlossaryDefinition = {
      id: t.id,
      definition: t.definition,
      see: t.see,
      lessons: t.lessons,
    };
    const own = bytes(JSON.stringify(part));
    // The term and, after another term, a comma.
    if (run.length > 0 && size + own + 1 > chunkBytes) {
      runs.push(run);
      run = [];
      size = bytes(empty);
    }
    size += own + (run.length > 0 ? 1 : 0);
    run.push(part);
    chunkOf.set(t.id, runs.length);
  }
  if (run.length > 0) runs.push(run);
  const chunks = runs.map((terms) => {
    const chunk: SiteGlossaryChunk = {
      format: GLOSSARY_FORMAT,
      language: glossary.language,
      terms,
    };
    const text = JSON.stringify(chunk);
    return { hash: hash(text), text };
  });
  return {
    index: {
      format: GLOSSARY_FORMAT,
      language: glossary.language,
      title: glossary.title,
      categories: glossary.categories,
      terms: glossary.terms.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        chunk: chunkOf.get(t.id) ?? 0,
      })),
      chunks: chunks.map((c) => c.hash),
    },
    chunks,
  };
}

/** The lesson with glossary terms linked in every level of every step and in «Как защититься». */
export function linkLessonTerms(lesson: SiteLesson, matcher: Matcher): SiteLesson {
  return {
    ...lesson,
    steps: lesson.steps.map((s) => ({
      ...s,
      levels: {
        simple: linkTerms(s.levels.simple, matcher),
        detailed: linkTerms(s.levels.detailed, matcher),
        deep: linkTerms(s.levels.deep, matcher),
      },
    })),
    defence: lesson.defence === null ? null : linkTerms(lesson.defence, matcher),
  };
}
