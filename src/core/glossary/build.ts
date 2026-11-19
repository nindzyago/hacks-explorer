/**
 * Build-time glue (M2.4): a checked glossary → its matcher and its site file, and a lesson's
 * text with the glossary terms linked. Used by scripts/lesson-data.ts.
 */
import type { SiteLesson } from '../lesson/site';
import { siteBlock } from '../lesson/site';
import type { Matcher } from './match';
import { createMatcher, linkTerms } from './match';
import type { SiteGlossary } from './site';
import { GLOSSARY_FORMAT } from './site';
import type { Glossary } from './types';

export function glossaryMatcher(glossary: Glossary): Matcher {
  return createMatcher(glossary.terms);
}

/**
 * The site file of a glossary. Definitions link the other terms they mention (never their own);
 * related lessons carry their title in the glossary's language (`titles`: id → title), and a
 * lesson without a title in that language is left out.
 */
export function toSiteGlossary(
  glossary: Glossary,
  titles: ReadonlyMap<string, string>,
): SiteGlossary {
  const matcher = glossaryMatcher(glossary);
  return {
    format: GLOSSARY_FORMAT,
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
