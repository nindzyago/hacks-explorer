/**
 * Lesson data for the site (design M1.1 E11, decision K37). The build turns each checked
 * `Lesson` into a `SiteLesson` file and writes a small `SiteCatalog`; the site fetches them and
 * never parses Markdown (K31). Plain JSON data: no positions, no HTML, text is a node tree.
 *
 * This file imports nothing that pulls the Markdown parser, so the site may import it.
 */
import type { Block, Inline, Lesson, MessageKind, Severity, StepMode } from './types';

/** Version of the data files; the loader rejects any other. */
export const SITE_FORMAT = 1;
/** Where the build puts the catalog, relative to the site root. */
export const CATALOG_FILE = 'data/catalog.json';
/** Budget of one lesson file (plan/architecture.md §6): 30 KB. */
export const MAX_LESSON_FILE_BYTES = 30 * 1024;

/** The file of one lesson in one language; `hash` changes whenever the content does. */
export function lessonFile(id: string, language: string, hash: string): string {
  return `data/lessons/${id}.${language}.${hash}.json`;
}

// ---------------------------------------------------------------------------------------------
// Text tree: the same nodes as the checker's, without source positions. Never HTML (E4).

export type SiteInline = Inline;

export interface SiteCodeSegment {
  readonly text: string;
  /** The harmful part, written ⟦…⟧ in the file. */
  readonly marked: boolean;
}

export interface SiteCode {
  readonly type: 'code';
  readonly lang: string;
  readonly segments: readonly SiteCodeSegment[];
}

export type SiteBlock =
  | { readonly type: 'paragraph'; readonly children: readonly SiteInline[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly SiteBlock[])[];
    }
  | SiteCode;

// ---------------------------------------------------------------------------------------------
// One lesson in one language

export interface SitePassport {
  readonly cwe: readonly number[];
  readonly owasp: readonly string[];
  readonly attack: readonly string[];
  readonly cvss: string | null;
  readonly cves: readonly string[];
  readonly severity: Severity | null;
  readonly impact: string | null;
  readonly defence: string | null;
  /** The class of the attack as text (K71), or null: the passport then names the CWE. */
  readonly class: string | null;
}

export interface SiteSource {
  readonly title: string;
  readonly url: string;
}

export interface SiteParticipant {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly icon: string;
}

export interface SiteZone {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly danger: boolean;
}

export interface SiteLevels {
  readonly simple: readonly SiteBlock[];
  readonly detailed: readonly SiteBlock[];
  readonly deep: readonly SiteBlock[];
}

export interface SiteStep {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  /** When the step plays: in both modes, or only with or without the defence (K20). */
  readonly mode: StepMode;
  readonly stopped: boolean;
  readonly icon: string | null;
  /** The plaque: message and result, plain text. */
  readonly message: string;
  readonly result: string;
  readonly code: SiteCode | null;
  readonly levels: SiteLevels;
}

export interface SiteLesson {
  readonly format: typeof SITE_FORMAT;
  readonly id: string;
  readonly section: string;
  readonly wave: number;
  readonly language: string;
  readonly title: string;
  readonly passport: SitePassport;
  readonly sources: readonly SiteSource[];
  readonly participants: readonly SiteParticipant[];
  readonly zones: readonly SiteZone[];
  readonly steps: readonly SiteStep[];
  /** «Как защититься», or null when the lesson has none. */
  readonly defence: readonly SiteBlock[] | null;
}

// ---------------------------------------------------------------------------------------------
// Catalog

export interface SiteTranslation {
  readonly language: string;
  readonly title: string;
  /** Content hash in the lesson's file name (`lessonFile`). */
  readonly hash: string;
}

export interface SiteCatalogEntry {
  readonly id: string;
  readonly section: string;
  readonly wave: number;
  /** Available languages, `ru` first. */
  readonly translations: readonly SiteTranslation[];
}

export interface SiteCatalog {
  readonly format: typeof SITE_FORMAT;
  readonly lessons: readonly SiteCatalogEntry[];
}

// ---------------------------------------------------------------------------------------------
// Lesson → site data

function siteBlock(block: Block): SiteBlock {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', children: block.children };
    case 'list':
      return {
        type: 'list',
        ordered: block.ordered,
        items: block.items.map((item) => item.map(siteBlock)),
      };
    case 'code':
      return siteCode(block);
  }
}

function siteCode(code: { lang: string; segments: readonly SiteCodeSegment[] }): SiteCode {
  return {
    type: 'code',
    lang: code.lang,
    segments: code.segments.map((s) => ({ text: s.text, marked: s.marked })),
  };
}

/** The data the site needs from a checked lesson. */
export function toSiteLesson(lesson: Lesson): SiteLesson {
  const p = lesson.passport;
  return {
    format: SITE_FORMAT,
    id: lesson.id,
    section: lesson.section,
    wave: lesson.wave,
    language: lesson.language,
    title: lesson.title,
    passport: {
      cwe: [...p.cwe],
      owasp: [...p.owasp],
      attack: [...p.attack],
      cvss: p.cvss,
      cves: [...p.cves],
      severity: p.severity,
      impact: p.impact,
      defence: p.defence,
      class: p.class,
    },
    sources: lesson.sources.map((s) => ({ title: s.title, url: s.url })),
    participants: lesson.participants.map((x) => ({
      id: x.id,
      name: x.name,
      note: x.note,
      icon: x.icon,
    })),
    zones: lesson.zones.map((z) => ({
      id: z.id,
      label: z.label,
      members: [...z.members],
      danger: z.danger,
    })),
    steps: lesson.steps.map((s) => ({
      id: s.id,
      title: s.title,
      from: s.from,
      to: s.to,
      kind: s.kind,
      mode: s.mode,
      stopped: s.stopped,
      icon: s.icon,
      message: s.message,
      result: s.result,
      code: s.code === null ? null : siteCode(s.code),
      levels: {
        simple: s.levels.simple.map(siteBlock),
        detailed: s.levels.detailed.map(siteBlock),
        deep: s.levels.deep.map(siteBlock),
      },
    })),
    defence: lesson.defence === null ? null : lesson.defence.map(siteBlock),
  };
}
