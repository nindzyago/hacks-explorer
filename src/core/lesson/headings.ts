/**
 * Section headings and labels in each lesson language. The parser recognises a section by its
 * heading text in the file's language (taken from the file name, `ru.md`). A new language is one
 * entry here; nothing else in the code changes.
 */

export type SectionKey =
  'passport' | 'sources' | 'participants' | 'zones' | 'steps' | 'defence' | 'sandbox';
export type LevelKey = 'simple' | 'detailed' | 'deep';

export interface LanguageWords {
  readonly sections: Readonly<Record<SectionKey, string>>;
  readonly levels: Readonly<Record<LevelKey, string>>;
  /** The two labels of a step's second line: `Сообщение: … · Итог: …`. */
  readonly message: string;
  readonly result: string;
}

const RU: LanguageWords = {
  sections: {
    passport: 'Паспорт',
    sources: 'Источники',
    participants: 'Участники',
    zones: 'Зоны',
    steps: 'Шаги',
    defence: 'Как защититься',
    sandbox: 'Песочница',
  },
  levels: { simple: 'Просто', detailed: 'По шагам', deep: 'Глубже' },
  message: 'Сообщение',
  result: 'Итог',
};

const EN: LanguageWords = {
  sections: {
    passport: 'Passport',
    sources: 'Sources',
    participants: 'Participants',
    zones: 'Zones',
    steps: 'Steps',
    defence: 'How to defend',
    sandbox: 'Sandbox',
  },
  levels: { simple: 'Simple', detailed: 'Step by step', deep: 'Deeper' },
  message: 'Message',
  result: 'Result',
};

const LANGUAGES = new Map<string, LanguageWords>([
  ['ru', RU],
  ['en', EN],
]);

/** The language every other language is checked against (decision K21). */
export const BASE_LANGUAGE = 'ru';

export function wordsFor(language: string): LanguageWords | null {
  return LANGUAGES.get(language) ?? null;
}

export function knownLanguages(): readonly string[] {
  return [...LANGUAGES.keys()];
}

/** Sections in the order they must appear. `sandbox` is never allowed in format 1. */
export const SECTION_ORDER: readonly SectionKey[] = [
  'passport',
  'sources',
  'participants',
  'zones',
  'steps',
  'defence',
];

export const LEVEL_ORDER: readonly LevelKey[] = ['simple', 'detailed', 'deep'];
