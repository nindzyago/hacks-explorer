/**
 * Lesson data (plan/architecture.md §2, design M1.1). Produced by `parseLesson` from one Markdown
 * file `content/lessons/<id>/<lang>.md`; plain frozen-able data that survives JSON.
 */

/** Where something is in the source file, 1-based. */
export interface Position {
  readonly line: number;
  readonly column: number;
}

// ---------------------------------------------------------------------------------------------
// Text tree: what the site renders with its own components. Never HTML (design E4).

export type Inline =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'strong'; readonly children: readonly Inline[] }
  | { readonly type: 'emphasis'; readonly children: readonly Inline[] }
  | { readonly type: 'code'; readonly value: string }
  | { readonly type: 'break' };

/** A piece of code; `marked` pieces are the harmful part, written ⟦…⟧ in the file. */
export interface CodeSegment {
  readonly text: string;
  readonly marked: boolean;
}

export interface CodeBlock {
  readonly type: 'code';
  /** The info string after the fence (`sql`, `http`), or '' when absent. */
  readonly lang: string;
  readonly segments: readonly CodeSegment[];
  readonly position: Position;
}

export type Block =
  | {
      readonly type: 'paragraph';
      readonly children: readonly Inline[];
      readonly position: Position;
    }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Block[])[];
      readonly position: Position;
    }
  | CodeBlock;

// ---------------------------------------------------------------------------------------------
// Lesson

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type MessageKind = 'legit' | 'attack' | 'safe';
/** `both`: the step plays in both modes; otherwise only in that mode (decision K20). */
export type StepMode = 'both' | 'with-defence' | 'without-defence';

export interface Passport {
  /** CWE numbers without the `CWE-` prefix. */
  readonly cwe: readonly number[];
  /** OWASP Top 10 items, `A03:2021`. */
  readonly owasp: readonly string[];
  /** MITRE ATT&CK techniques, `T1566` or `T1566.002`. */
  readonly attack: readonly string[];
  /** CVSS vector string, `CVSS:3.1/AV:N/…`, or null. */
  readonly cvss: string | null;
  readonly cves: readonly string[];
  readonly severity: Severity | null;
  /** Text in the lesson's language: what the attacker gets. */
  readonly impact: string | null;
  /** Text in the lesson's language: the name of the defence shown on the switch. */
  readonly defence: string | null;
}

export interface Source {
  readonly title: string;
  readonly url: string;
  readonly position: Position;
}

export interface Participant {
  readonly id: string;
  readonly name: string;
  /** The text after the dash: an address, a table, a role. '' when absent. */
  readonly note: string;
  /** Icon name from `content/icons`; the id unless the line says `icon:<name>`. */
  readonly icon: string;
  readonly position: Position;
}

export interface Zone {
  readonly id: string;
  readonly label: string;
  /** Participant ids, in the order of the participants line. */
  readonly members: readonly string[];
  /** A dangerous zone (a fake site) is drawn red. */
  readonly danger: boolean;
  readonly position: Position;
}

export interface Levels {
  /** «Просто» */
  readonly simple: readonly Block[];
  /** «По шагам» */
  readonly detailed: readonly Block[];
  /** «Глубже» */
  readonly deep: readonly Block[];
}

export interface Step {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly mode: StepMode;
  /** The defence stopped this message (design E9). Only on `with-defence` steps. */
  readonly stopped: boolean;
  /** Icon of the message plaque, or null for the default. */
  readonly icon: string | null;
  /** Short plain text on the message plaque. */
  readonly message: string;
  /** Short plain text: what came of the step. */
  readonly result: string;
  /** The step's code, shown at every depth; placed before the first level heading. */
  readonly code: CodeBlock | null;
  readonly levels: Levels;
  /** The heading `### `id` Title`. */
  readonly position: Position;
  /** The service line `from → to` · kind. */
  readonly servicePosition: Position;
}

export interface Lesson {
  readonly id: string;
  /** Section letter, the first letter of the id. */
  readonly section: string;
  readonly wave: number;
  readonly format: 1;
  readonly language: string;
  readonly title: string;
  readonly passport: Passport;
  readonly sources: readonly Source[];
  readonly participants: readonly Participant[];
  readonly zones: readonly Zone[];
  readonly steps: readonly Step[];
  /** «Как защититься», or null when the section is absent. */
  readonly defence: readonly Block[] | null;
}

// ---------------------------------------------------------------------------------------------
// Errors: plain data, never exceptions (K13 house style).

export interface LessonError {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** Where in the lesson: `steps.glue.deep`, `participants.db`, `sources`. */
  readonly path: string;
  readonly code: LessonErrorCode;
  /** English, for the author: names the line and shows the right form. */
  readonly message: string;
}

export type LessonErrorCode =
  // the file as a whole
  | 'bad-path'
  | 'unknown-language'
  | 'too-large'
  | 'too-deep'
  | 'too-complex'
  | 'parse-failed'
  | 'unexpected-file'
  | 'too-many-errors'
  // structure
  | 'missing-title'
  | 'bad-header'
  | 'unknown-word'
  | 'duplicate'
  | 'bad-value'
  | 'unknown-section'
  | 'missing-section'
  | 'section-order'
  | 'sandbox-not-allowed'
  | 'stray-content'
  | 'bad-line'
  | 'empty-section'
  // text
  | 'html'
  | 'image'
  | 'link'
  | 'not-allowed'
  | 'bad-mark'
  // steps
  | 'unknown-level'
  | 'missing-level'
  | 'unknown-participant'
  // content rules (S8, L4, L5)
  | 'too-many-participants'
  | 'zone-not-contiguous'
  | 'zone-overlap'
  | 'stopped-without-defence'
  | 'no-defence-step'
  | 'no-defence-section'
  | 'no-defence-name'
  | 'no-sources'
  | 'source-domain'
  | 'address'
  // translations
  | 'missing-base'
  | 'translation-mismatch';
