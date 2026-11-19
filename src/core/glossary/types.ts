/**
 * The glossary (M2.4, K7, K98): one Markdown file per language, `content/locales/<lang>/glossary.md`.
 * `checkGlossaries` turns it into this data; the build links terms in lesson text and writes
 * `data/glossary/<lang>.json` for the site. Plain data that survives JSON.
 */
import type { Block, Position } from '../lesson/types';

export interface GlossaryCategory {
  /** A service id, the same in every language: `web`. */
  readonly id: string;
  /** Text in the file's language: «Веб и базы данных». */
  readonly label: string;
  readonly position: Position;
}

export interface GlossaryTerm {
  /** A service id, the same in every language: `sql-injection`. */
  readonly id: string;
  /** The heading text: «SQL-инъекция». */
  readonly title: string;
  readonly category: string;
  /**
   * The word forms the build looks for in lesson text, as written (`запрос`, `запроса`…). Plain
   * words, never patterns. Empty: the term is reached only from the scene and «см. также».
   */
  readonly forms: readonly string[];
  /** «См. также»: other term ids. */
  readonly see: readonly string[];
  /** Related lesson ids, `B1`. */
  readonly lessons: readonly string[];
  readonly definition: readonly Block[];
  /** The heading `## `id` Title`. */
  readonly position: Position;
}

export interface Glossary {
  readonly language: string;
  /** The file heading: «Словарь». */
  readonly title: string;
  readonly categories: readonly GlossaryCategory[];
  readonly terms: readonly GlossaryTerm[];
}
