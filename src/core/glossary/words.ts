/**
 * The words of a glossary file in each language: the title, the categories heading and the label
 * of the forms line. A new language is one entry here, like src/core/lesson/headings.ts.
 */

export interface GlossaryWords {
  /** `# Словарь` */
  readonly title: string;
  /** `## Разделы` */
  readonly categories: string;
  /** `Формы: запрос, запроса, …` */
  readonly forms: string;
}

const WORDS = new Map<string, GlossaryWords>([
  ['ru', { title: 'Словарь', categories: 'Разделы', forms: 'Формы' }],
  ['en', { title: 'Glossary', categories: 'Sections', forms: 'Forms' }],
]);

export function glossaryWordsFor(language: string): GlossaryWords | null {
  return WORDS.get(language) ?? null;
}

export function glossaryLanguages(): readonly string[] {
  return [...WORDS.keys()];
}
