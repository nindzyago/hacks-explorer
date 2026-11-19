/**
 * One lesson file (Markdown, already parsed by mdast-util-from-markdown) → lesson data. Pure: no
 * file system, no exceptions. Structure errors go to the reporter; content rules are in rules.ts.
 * The format is described in README.md.
 */
import type { Heading, Nodes, Paragraph, Root, RootContent } from 'mdast';
import { parseCvss31 } from '../cvss/cvss';
import type { LanguageWords, LevelKey, SectionKey } from './headings';
import { LEVEL_ORDER, SECTION_ORDER } from './headings';
import { unknownId } from './ids';
import type { Reporter } from './report';
import { START, quote } from './report';
import { blocks, checkPlainLine, codeBlock, plainText, positionOf } from './text';
import type {
  Block,
  CodeBlock,
  Lesson,
  MessageKind,
  Participant,
  Passport,
  Position,
  Severity,
  Source,
  Step,
  StepMode,
  Zone,
} from './types';

export const ID = /^[a-z][a-z0-9-]{0,31}$/;
const ID_HINT = 'lowercase Latin letters, digits and hyphens, starting with a letter';

/** Where the sections start; rules point at them when something is missing. */
export interface Anchors {
  readonly header: Position;
  readonly sections: Partial<Record<SectionKey, Position>>;
}

export interface ParsedLesson {
  readonly draft: Lesson;
  readonly anchors: Anchors;
  /** Offsets of the links in «Источники»: real sites, skipped by the address check. */
  readonly sourceLinkRanges: readonly (readonly [number, number])[];
  /** Lines in «Источники», valid or not: an invalid line is its own error, not «no sources». */
  readonly sourceLines: number;
  /** Offsets of code blocks: the only place for ⟦…⟧ marks. */
  readonly codeRanges: readonly (readonly [number, number])[];
}

interface Context {
  readonly text: string;
  readonly words: LanguageWords;
  readonly reporter: Reporter;
}

function raw(ctx: Context, node: Nodes): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return '';
  return ctx.text.slice(start, end);
}

/** A one-line value: list item continuation lines are joined with a space. */
function flat(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim();
}

/** Heading text for matching against the heading table; markup shows as U+FFFD and never matches. */
function headingText(node: Heading): string {
  return node.children
    .map((c) =>
      c.type === 'text' ? c.value : c.type === 'inlineCode' ? `\`${c.value}\`` : '\uFFFD',
    )
    .join('')
    .trim();
}

/**
 * The paragraph of a list item, or null (and an error) when the item is something else. With
 * `plain`, the paragraph must also be plain text (service words allowed; bold when `strong`).
 */
function itemParagraph(
  ctx: Context,
  item: Nodes,
  path: string,
  hint: string,
  plain?: { strong?: boolean },
): Paragraph | null {
  if (item.type === 'listItem' && item.children.length === 1) {
    const only = item.children[0];
    if (only?.type === 'paragraph') {
      if (plain === undefined) return only;
      const allow = { code: true, strong: plain.strong === true };
      return checkPlainLine(only.children, ctx.reporter, path, allow) ? only : null;
    }
  }
  ctx.reporter.add(positionOf(item), path, 'bad-line', `expected one line: ${hint}`);
  return null;
}

/** Items of the lists in a section; anything else in the section is stray. */
function listItems(ctx: Context, nodes: readonly RootContent[], path: string): Nodes[] {
  const items: Nodes[] = [];
  for (const node of nodes) {
    if (node.type === 'list' && node.ordered !== true) items.push(...node.children);
    else
      ctx.reporter.add(
        positionOf(node),
        path,
        'stray-content',
        `only a "- " list is allowed in this section, found ${node.type}`,
      );
  }
  return items;
}

// ---------------------------------------------------------------------------------------------
// Header

const HEADER_HINT = '`lesson` B1 · `section` B · `wave` 1 · `format` 1';

interface Header {
  section: string;
  wave: number;
}

function parseHeader(ctx: Context, node: RootContent | undefined, id: string): Header {
  const header: Header = { section: id.slice(0, 1), wave: 0 };
  if (node?.type !== 'paragraph') {
    const at = node === undefined ? START : positionOf(node);
    ctx.reporter.add(at, 'header', 'bad-header', `after the title comes the line ${HEADER_HINT}`);
    return header;
  }
  const at = positionOf(node);
  if (!checkPlainLine(node.children, ctx.reporter, 'header', { code: true })) return header;
  const values = new Map<string, string>();
  for (const token of flat(raw(ctx, node)).split(/\s+·\s+/)) {
    const match = /^`([^`]*)`\s+(\S+)$/.exec(token);
    if (match === null) {
      ctx.reporter.add(
        at,
        'header',
        'bad-header',
        `cannot read "${quote(token)}"; expected ${HEADER_HINT}`,
      );
      return header;
    }
    const [, word = '', value = ''] = match;
    if (!['lesson', 'section', 'wave', 'format'].includes(word)) {
      ctx.reporter.add(
        at,
        'header',
        'unknown-word',
        `unknown word \`${quote(word, 32)}\` in the header; known: lesson, section, wave, format`,
      );
    } else if (values.has(word)) {
      ctx.reporter.add(at, 'header', 'duplicate', `\`${word}\` appears twice in the header`);
    } else {
      values.set(word, value);
    }
  }
  const missing = ['lesson', 'section', 'wave', 'format'].filter((w) => !values.has(w));
  if (missing.length > 0) {
    ctx.reporter.add(
      at,
      'header',
      'bad-header',
      `the header misses ${missing.map((w) => `\`${w}\``).join(', ')}; expected ${HEADER_HINT}`,
    );
  }
  const lesson = values.get('lesson');
  if (lesson !== undefined && lesson !== id) {
    ctx.reporter.add(
      at,
      'header',
      'bad-value',
      `\`lesson\` ${quote(lesson, 16)} does not match the folder ${id}`,
    );
  }
  const section = values.get('section');
  if (section !== undefined && section !== id.slice(0, 1)) {
    ctx.reporter.add(
      at,
      'header',
      'bad-value',
      `\`section\` ${quote(section, 16)} must be the first letter of the lesson id: ${id.slice(0, 1)}`,
    );
  }
  const wave = values.get('wave');
  if (wave !== undefined) {
    if (/^[1-3]$/.test(wave)) header.wave = Number(wave);
    else
      ctx.reporter.add(
        at,
        'header',
        'bad-value',
        `\`wave\` must be 1, 2 or 3, not ${quote(wave, 16)}`,
      );
  }
  const format = values.get('format');
  if (format !== undefined && format !== '1') {
    ctx.reporter.add(
      at,
      'header',
      'bad-value',
      `\`format\` ${quote(format, 16)} is not supported; this checker reads format 1`,
    );
  }
  return header;
}

// ---------------------------------------------------------------------------------------------
// Passport

const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical'];
const LIST_VALUE: Readonly<Record<string, { re: RegExp; hint: string }>> = {
  cwe: { re: /^[1-9]\d{0,4}$/, hint: 'CWE numbers without the prefix: 89, 564' },
  owasp: {
    re: /^(A|LLM)(0[1-9]|10):20\d\d$/,
    hint: 'OWASP Top 10 items: A03:2021, or LLM Top 10 items: LLM01:2025',
  },
  attack: { re: /^T\d{4}(\.\d{3})?$/, hint: 'ATT&CK techniques: T1566 or T1566.002' },
  // The official form (cve.org): year from 1999, then four digits, or more without a leading 0.
  cves: {
    re: /^CVE-(1999|20\d\d)-(\d{4}|[1-9]\d{4,6})$/,
    hint: 'CVE ids: CVE-2021-44228, CVE-2014-0160',
  },
};
const PASSPORT_WORDS = [
  'class',
  'cwe',
  'owasp',
  'attack',
  'cvss',
  'cves',
  'severity',
  'impact',
  'defence',
];

function unknownIdOf(word: string, value: string): string | null {
  return word === 'cwe' || word === 'owasp' || word === 'attack' || word === 'cves'
    ? unknownId(word, value)
    : null;
}

function parsePassport(ctx: Context, nodes: readonly RootContent[]): Passport {
  const passport: { -readonly [K in keyof Passport]: Passport[K] } = {
    cwe: [],
    owasp: [],
    attack: [],
    cvss: null,
    cves: [],
    severity: null,
    impact: null,
    defence: null,
    class: null,
  };
  const seen = new Set<string>();
  for (const item of listItems(ctx, nodes, 'passport')) {
    const p = itemParagraph(ctx, item, 'passport', '- `cwe` 89', {});
    if (p === null) continue;
    const at = positionOf(p);
    const match = /^`([^`]*)`\s+(.+)$/.exec(flat(raw(ctx, p)));
    if (match === null) {
      ctx.reporter.add(
        at,
        'passport',
        'bad-line',
        `a passport line looks like - \`cwe\` 89, not "${quote(flat(raw(ctx, p)))}"`,
      );
      continue;
    }
    const [, word = '', value = ''] = match;
    const path = `passport.${quote(word, 32)}`;
    if (!PASSPORT_WORDS.includes(word)) {
      ctx.reporter.add(
        at,
        path,
        'unknown-word',
        `unknown passport word \`${quote(word, 32)}\`; known: ${PASSPORT_WORDS.join(', ')}`,
      );
      continue;
    }
    if (seen.has(word)) {
      ctx.reporter.add(at, path, 'duplicate', `\`${word}\` appears twice in the passport`);
      continue;
    }
    seen.add(word);
    const listRule = LIST_VALUE[word];
    if (listRule !== undefined) {
      const parts = value.split(/\s*,\s*/);
      const bad = parts.find((part) => !listRule.re.test(part));
      if (bad !== undefined) {
        ctx.reporter.add(
          at,
          path,
          'bad-value',
          `\`${word}\`: "${quote(bad, 32)}" is not valid; expected ${listRule.hint}`,
        );
        continue;
      }
      // M2.8: the id must also be in its vetted list (ids.ts, L5).
      const unknown = parts.flatMap((part) => unknownIdOf(word, part) ?? []);
      for (const message of unknown) ctx.reporter.add(at, path, 'unknown-id', message);
      if (unknown.length > 0) continue;
      if (word === 'cwe') passport.cwe = parts.map(Number);
      else if (word === 'owasp') passport.owasp = parts;
      else if (word === 'attack') passport.attack = parts;
      else passport.cves = parts;
    } else if (word === 'cvss') {
      // M2.5 (K82): a CVSS v3.1 vector read by src/core/cvss, all eight base metrics.
      const cvss = parseCvss31(value);
      if (cvss.ok) passport.cvss = value;
      else
        ctx.reporter.add(
          at,
          path,
          'bad-value',
          `\`cvss\` must be a CVSS v3.1 vector string: CVSS:3.1/AV:N/AC:L/…; ${cvss.error.message}`,
        );
    } else if (word === 'severity') {
      const severity = SEVERITIES.find((s) => s === value);
      if (severity === undefined) {
        ctx.reporter.add(
          at,
          path,
          'bad-value',
          `\`severity\` must be one of ${SEVERITIES.join(', ')}`,
        );
      } else passport.severity = severity;
    } else if (word === 'impact') passport.impact = value;
    else if (word === 'class') passport.class = value;
    else passport.defence = value;
  }
  return passport;
}

// ---------------------------------------------------------------------------------------------
// Sources

function parseSources(
  ctx: Context,
  nodes: readonly RootContent[],
  urlRanges: (readonly [number, number])[],
): Source[] {
  const sources: Source[] = [];
  for (const item of listItems(ctx, nodes, 'sources')) {
    const p = itemParagraph(ctx, item, 'sources', '- [Title](link)');
    if (p === null) continue;
    const parts = p.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''));
    for (const part of parts) {
      // A link here names and points at a real site, even when the line is malformed.
      const start = part.position?.start.offset;
      const end = part.position?.end.offset;
      if (part.type === 'link' && start !== undefined && end !== undefined) {
        urlRanges.push([start, end]);
      }
    }
    const link = parts[0];
    if (
      parts.length !== 1 ||
      link?.type !== 'link' ||
      !link.children.every((c) => c.type === 'text')
    ) {
      ctx.reporter.add(
        positionOf(p),
        'sources',
        'bad-line',
        'a source is one https link: - [Title](link)',
      );
      continue;
    }
    const title = link.children
      .map((c) => c.value)
      .join('')
      .trim();
    sources.push({ title, url: link.url, position: positionOf(p) });
  }
  return sources;
}

// ---------------------------------------------------------------------------------------------
// Participants and zones

const PARTICIPANT = /^`([^`]*)`\s+\*\*([^*`]+)\*\*(?:\s+—\s+(.+?))?(?:\s+·\s+`icon:([^`]*)`)?$/;
const PARTICIPANT_HINT = '- `server` **Веб-сервер** — 198.51.100.10 (· `icon:name` optional)';

function checkId(ctx: Context, at: Position, path: string, what: string, id: string): boolean {
  if (ID.test(id)) return true;
  ctx.reporter.add(at, path, 'bad-value', `${what} \`${quote(id, 32)}\` must be ${ID_HINT}`);
  return false;
}

function parseParticipants(ctx: Context, nodes: readonly RootContent[]): Participant[] {
  const out: Participant[] = [];
  for (const item of listItems(ctx, nodes, 'participants')) {
    const p = itemParagraph(ctx, item, 'participants', PARTICIPANT_HINT, { strong: true });
    if (p === null) continue;
    const at = positionOf(p);
    const line = flat(raw(ctx, p));
    const match = PARTICIPANT.exec(line);
    if (match === null) {
      ctx.reporter.add(
        at,
        'participants',
        'bad-line',
        `a participant line looks like ${PARTICIPANT_HINT}`,
      );
      continue;
    }
    const [, id = '', name = '', note = '', icon] = match;
    const path = `participants.${quote(id, 32)}`;
    if (!checkId(ctx, at, path, 'participant id', id)) continue;
    if (icon !== undefined && !checkId(ctx, at, path, 'icon name', icon)) continue;
    if (out.some((x) => x.id === id)) {
      ctx.reporter.add(at, path, 'duplicate', `participant \`${id}\` is listed twice`);
      continue;
    }
    out.push({ id, name: name.trim(), note: note.trim(), icon: icon ?? id, position: at });
  }
  return out;
}

const ZONE = /^`([^`]*)`\s+(.+?):\s+((?:`[^`]*`\s*,\s*)*`[^`]*`)(\s+·\s+`danger`)?$/;
const ZONE_HINT = '- `site` Сайт: `server`, `db` (· `danger` optional)';

function parseZones(ctx: Context, nodes: readonly RootContent[]): Zone[] {
  const out: Zone[] = [];
  for (const item of listItems(ctx, nodes, 'zones')) {
    const p = itemParagraph(ctx, item, 'zones', ZONE_HINT, {});
    if (p === null) continue;
    const at = positionOf(p);
    const match = ZONE.exec(flat(raw(ctx, p)));
    if (match === null) {
      ctx.reporter.add(at, 'zones', 'bad-line', `a zone line looks like ${ZONE_HINT}`);
      continue;
    }
    const [, id = '', label = '', list = '', danger] = match;
    const path = `zones.${quote(id, 32)}`;
    if (!checkId(ctx, at, path, 'zone id', id)) continue;
    if (out.some((z) => z.id === id)) {
      ctx.reporter.add(at, path, 'duplicate', `zone \`${id}\` is listed twice`);
      continue;
    }
    const members = [...list.matchAll(/`([^`]*)`/g)].map((m) => m[1] ?? '');
    out.push({ id, label: label.trim(), members, danger: danger !== undefined, position: at });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Steps

const KINDS: readonly MessageKind[] = ['legit', 'attack', 'safe'];
const MODES: readonly StepMode[] = ['with-defence', 'without-defence'];
const STEP_HINT =
  '`server → db` · `attack` (· `with-defence` or `without-defence`, `stopped`, `icon:name`)';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ServiceLine {
  from: string;
  to: string;
  kind: MessageKind;
  mode: StepMode;
  stopped: boolean;
  icon: string | null;
  message: string;
  result: string;
}

function parseServiceLine(ctx: Context, p: Paragraph, path: string): ServiceLine | null {
  const at = positionOf(p);
  const lines = raw(ctx, p)
    .split('\n')
    .map((l) => l.trim());
  const plaqueHint = `${ctx.words.message}: … · ${ctx.words.result}: …`;
  if (lines.length !== 2) {
    ctx.reporter.add(
      at,
      path,
      'bad-line',
      `a step starts with two lines: ${STEP_HINT}, then ${plaqueHint}`,
    );
    return null;
  }
  const tokens = (lines[0] ?? '').split(/\s+·\s+/);
  const words: string[] = [];
  for (const token of tokens) {
    const m = /^`([^`]+)`$/.exec(token);
    if (m === null) {
      ctx.reporter.add(
        at,
        path,
        'bad-line',
        `cannot read "${quote(token)}"; the line looks like ${STEP_HINT}`,
      );
      return null;
    }
    words.push(m[1] ?? '');
  }
  const route = /^(\S+)\s*→\s*(\S+)$/.exec(words[0] ?? '');
  if (route === null) {
    ctx.reporter.add(at, path, 'bad-line', `the line starts with \`from → to\`: ${STEP_HINT}`);
    return null;
  }
  const line: ServiceLine = {
    from: route[1] ?? '',
    to: route[2] ?? '',
    kind: 'legit',
    mode: 'both',
    stopped: false,
    icon: null,
    message: '',
    result: '',
  };
  let kind: MessageKind | null = null;
  const seen = new Set<string>();
  const once = (key: string, word: string): boolean => {
    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    ctx.reporter.add(
      at,
      path,
      'duplicate',
      `\`${quote(word, 32)}\` conflicts with an earlier word in this line`,
    );
    return false;
  };
  for (const word of words.slice(1)) {
    const k = KINDS.find((x) => x === word);
    const mode = MODES.find((x) => x === word);
    if (k !== undefined) {
      if (once('kind', word)) kind = k;
    } else if (mode !== undefined) {
      if (once('mode', word)) line.mode = mode;
    } else if (word === 'stopped') {
      if (once('stopped', word)) line.stopped = true;
    } else if (word.startsWith('icon:')) {
      const icon = word.slice(5);
      if (once('icon', word) && checkId(ctx, at, path, 'icon name', icon)) line.icon = icon;
    } else {
      const known = [...KINDS, ...MODES, 'stopped', 'icon:<name>'].join(', ');
      const code = /^[a-z-]+$/.test(word) ? 'unknown-word' : 'bad-value';
      ctx.reporter.add(
        at,
        path,
        code,
        `unknown word \`${quote(word, 32)}\` in a step line; known: ${known}`,
      );
    }
  }
  if (kind === null) {
    ctx.reporter.add(at, path, 'bad-line', `a step needs a kind: ${KINDS.join(', ')}`);
    return null;
  }
  line.kind = kind;
  const plaque = new RegExp(
    `^${escapeRegExp(ctx.words.message)}:\\s*(.+?)\\s+·\\s+${escapeRegExp(ctx.words.result)}:\\s*(.+)$`,
  ).exec(lines[1] ?? '');
  if (plaque === null) {
    ctx.reporter.add(
      { line: at.line + 1, column: 1 },
      path,
      'bad-line',
      `the second line of a step looks like ${plaqueHint}`,
    );
    return null;
  }
  line.message = (plaque[1] ?? '').trim();
  line.result = (plaque[2] ?? '').trim();
  return line;
}

function levelKey(words: LanguageWords, text: string): LevelKey | null {
  return LEVEL_ORDER.find((key) => words.levels[key] === text) ?? null;
}

function parseStep(ctx: Context, heading: Heading, body: readonly RootContent[]): Step | null {
  const at = positionOf(heading);
  const first = heading.children[0];
  const rest = heading.children.slice(1);
  const title = plainText(rest);
  if (first?.type !== 'inlineCode' || title === null || title === '') {
    checkPlainLine(rest, ctx.reporter, 'steps', {});
    ctx.reporter.add(
      at,
      'steps',
      'bad-line',
      'a step heading looks like ### `id` Title, the title plain text',
    );
    return null;
  }
  const id = first.value;
  const path = `steps.${quote(id, 32)}`;
  if (!checkId(ctx, at, path, 'step id', id)) return null;

  const service = body[0];
  if (service?.type !== 'paragraph') {
    ctx.reporter.add(at, path, 'bad-line', `after the heading comes the line ${STEP_HINT}`);
    return null;
  }
  const line = checkPlainLine(service.children, ctx.reporter, path, { code: true })
    ? parseServiceLine(ctx, service, path)
    : null;

  let i = 1;
  let code: CodeBlock | null = null;
  const next = body[i];
  if (next?.type === 'code') {
    code = codeBlock(next, ctx.reporter, `${path}.code`);
    i += 1;
  }
  const levels: Partial<Record<LevelKey, Block[]>> = {};
  let lastOrder = -1;
  let current: { key: LevelKey; nodes: RootContent[] } | null = null;
  let skipping = false;
  const flush = () => {
    if (current !== null)
      levels[current.key] = blocks(current.nodes, ctx.reporter, `${path}.${current.key}`);
    current = null;
  };
  for (; i < body.length; i += 1) {
    const node = body[i];
    if (node === undefined) continue;
    if (node.type === 'heading' && node.depth === 4) {
      flush();
      skipping = true;
      const text = headingText(node);
      const key = levelKey(ctx.words, text);
      const where = positionOf(node);
      if (key === null) {
        const known = LEVEL_ORDER.map((k) => ctx.words.levels[k]).join(', ');
        ctx.reporter.add(
          where,
          path,
          'unknown-level',
          `unknown level «${quote(text, 40)}»; known: ${known}`,
        );
        continue;
      }
      if (levels[key] !== undefined) {
        ctx.reporter.add(
          where,
          path,
          'duplicate',
          `level «${ctx.words.levels[key]}» appears twice`,
        );
        continue;
      }
      const order = LEVEL_ORDER.indexOf(key);
      if (order < lastOrder) {
        const known = LEVEL_ORDER.map((k) => ctx.words.levels[k]).join(', ');
        ctx.reporter.add(where, path, 'section-order', `levels go in the order ${known}`);
      }
      lastOrder = Math.max(lastOrder, order);
      current = { key, nodes: [] };
      skipping = false;
      continue;
    }
    if (current !== null) current.nodes.push(node);
    else if (!skipping) {
      ctx.reporter.add(
        positionOf(node),
        path,
        'stray-content',
        `before the first level heading only one code block may stand, found ${node.type}`,
      );
    }
  }
  flush();

  const all = LEVEL_ORDER.map((k) => ctx.words.levels[k])
    .map((w) => `«${w}»`)
    .join(', ');
  for (const key of LEVEL_ORDER) {
    const level = levels[key];
    if (level === undefined || level.length === 0) {
      ctx.reporter.add(
        at,
        path,
        'missing-level',
        `step \`${id}\`: level «${ctx.words.levels[key]}» is missing or empty; every step needs ${all}`,
      );
    }
  }
  if (line === null) return null;
  return {
    id,
    title,
    ...line,
    code,
    levels: {
      simple: levels.simple ?? [],
      detailed: levels.detailed ?? [],
      deep: levels.deep ?? [],
    },
    position: at,
    servicePosition: positionOf(service),
  };
}

function parseSteps(ctx: Context, nodes: readonly RootContent[]): Step[] {
  const steps: Step[] = [];
  let heading: Heading | null = null;
  let body: RootContent[] = [];
  const flush = () => {
    if (heading === null) return;
    const step = parseStep(ctx, heading, body);
    if (step !== null) {
      if (steps.some((s) => s.id === step.id)) {
        ctx.reporter.add(
          step.position,
          `steps.${step.id}`,
          'duplicate',
          `step \`${step.id}\` appears twice`,
        );
      } else steps.push(step);
    }
  };
  for (const node of nodes) {
    if (node.type === 'heading' && node.depth === 3) {
      flush();
      heading = node;
      body = [];
    } else if (heading !== null) body.push(node);
    else
      ctx.reporter.add(
        positionOf(node),
        'steps',
        'stray-content',
        `steps start with a heading ### \`id\` Title, found ${node.type}`,
      );
  }
  flush();
  return steps;
}

// ---------------------------------------------------------------------------------------------
// The file

function sectionKey(words: LanguageWords, text: string): SectionKey | null {
  const keys: readonly SectionKey[] = [...SECTION_ORDER, 'sandbox'];
  return keys.find((key) => words.sections[key] === text) ?? null;
}

function collectCodeRanges(root: Root): [number, number][] {
  const ranges: [number, number][] = [];
  const stack: Nodes[] = [root];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.type === 'code') {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) ranges.push([start, end]);
    } else if ('children' in node) {
      stack.push(...node.children);
    }
  }
  return ranges;
}

export function parseLesson(
  root: Root,
  text: string,
  meta: { id: string; language: string; words: LanguageWords },
  reporter: Reporter,
): ParsedLesson {
  const ctx: Context = { text, words: meta.words, reporter };
  const nodes = root.children;
  let title = '';
  let index = 0;
  const first = nodes[0];
  if (first?.type === 'heading' && first.depth === 1) {
    index = 1;
    if (checkPlainLine(first.children, reporter, 'title', {})) {
      title = plainText(first.children) ?? '';
      if (title === '')
        reporter.add(positionOf(first), 'title', 'missing-title', 'the title is empty');
    }
  } else {
    reporter.add(
      first === undefined ? START : positionOf(first),
      'title',
      'missing-title',
      'a lesson starts with its title: # Title',
    );
  }
  const headerNode = nodes[index];
  const headerIsSection = headerNode?.type === 'heading';
  const header = parseHeader(ctx, headerIsSection ? undefined : headerNode, meta.id);
  const anchors: { header: Position; sections: Partial<Record<SectionKey, Position>> } = {
    header: headerNode === undefined ? START : positionOf(headerNode),
    sections: {},
  };
  if (!headerIsSection) index += 1;

  const content: Partial<Record<SectionKey, RootContent[]>> = {};
  let currentNodes: RootContent[] | null = null;
  let lastOrder = -1;
  let beforeSections = true;
  const known = SECTION_ORDER.map((k) => meta.words.sections[k]).join(', ');
  for (; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) continue;
    if (node.type === 'heading' && node.depth <= 2) {
      currentNodes = null;
      beforeSections = false;
      const at = positionOf(node);
      const text = headingText(node);
      const key = node.depth === 2 ? sectionKey(meta.words, text) : null;
      if (key === 'sandbox') {
        reporter.add(
          at,
          'sandbox',
          'sandbox-not-allowed',
          `section «${text}» is reserved and not allowed in format 1`,
        );
        continue;
      }
      if (key === null) {
        reporter.add(
          at,
          'sections',
          'unknown-section',
          `unknown section «${quote(text, 40)}»; known: ${known}`,
        );
        continue;
      }
      if (content[key] !== undefined) {
        reporter.add(at, key, 'duplicate', `section «${text}» appears twice`);
        continue;
      }
      const order = SECTION_ORDER.indexOf(key);
      if (order < lastOrder) {
        reporter.add(at, key, 'section-order', `sections go in the order ${known}`);
      }
      lastOrder = Math.max(lastOrder, order);
      currentNodes = [];
      content[key] = currentNodes;
      anchors.sections[key] = at;
      continue;
    }
    if (currentNodes !== null) currentNodes.push(node);
    else if (beforeSections) {
      reporter.add(
        positionOf(node),
        'sections',
        'stray-content',
        `between the header line and the first section nothing may stand, found ${node.type}`,
      );
    }
  }

  for (const key of ['passport', 'sources', 'participants', 'steps'] as const) {
    if (content[key] === undefined) {
      reporter.add(
        START,
        key,
        'missing-section',
        `section «${meta.words.sections[key]}» is missing`,
      );
    }
  }
  const urlRanges: (readonly [number, number])[] = [];
  const sourceNodes = content.sources ?? [];
  const sourceLines = sourceNodes.reduce(
    (n, node) => n + (node.type === 'list' ? node.children.length : 1),
    0,
  );
  const participants = parseParticipants(ctx, content.participants ?? []);
  const draft: Lesson = {
    id: meta.id,
    section: header.section,
    wave: header.wave,
    format: 1,
    language: meta.language,
    title,
    passport: parsePassport(ctx, content.passport ?? []),
    sources: parseSources(ctx, sourceNodes, urlRanges),
    participants,
    zones: parseZones(ctx, content.zones ?? []),
    steps: parseSteps(ctx, content.steps ?? []),
    defence: content.defence === undefined ? null : blocks(content.defence, reporter, 'defence'),
  };
  if (content.participants !== undefined && participants.length === 0) {
    reporter.add(
      anchors.sections.participants ?? START,
      'participants',
      'empty-section',
      'a lesson needs participants',
    );
  }
  if (content.steps !== undefined && draft.steps.length === 0) {
    reporter.add(anchors.sections.steps ?? START, 'steps', 'empty-section', 'a lesson needs steps');
  }
  if (draft.defence !== null && draft.defence.length === 0) {
    reporter.add(
      anchors.sections.defence ?? START,
      'defence',
      'empty-section',
      `section «${meta.words.sections.defence}» is empty`,
    );
  }
  return {
    draft,
    anchors,
    sourceLinkRanges: urlRanges,
    sourceLines,
    codeRanges: collectCodeRanges(root),
  };
}
