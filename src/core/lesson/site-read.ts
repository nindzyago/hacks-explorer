/**
 * Reads the site's lesson data (site.ts) from untrusted input (L0.2): the file may be
 * corrupted, cut off or swapped. Returns typed data or a `bad-data` error naming where the data
 * is wrong; never throws, never trusts a cast. Builds fresh objects, so extra fields and
 * `__proto__` keys are dropped.
 */
import type { MessageKind, Severity, StepMode } from './types';
import type {
  SiteBlock,
  SiteCatalog,
  SiteCatalogEntry,
  SiteCode,
  SiteCodeSegment,
  SiteInline,
  SiteLesson,
  SiteLevels,
  SiteParticipant,
  SitePassport,
  SiteSource,
  SiteStep,
  SiteTranslation,
  SiteZone,
} from './site';
import { SITE_FORMAT } from './site';

export interface ReadError {
  readonly code: 'bad-data';
  /** `steps[0].kind: expected one of legit, attack, safe` */
  readonly message: string;
}

export type ReadResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ReadError };

/** Text and lists nest deeper than the checker allows (16) → bad data; keeps the stack safe. */
const MAX_TEXT_DEPTH = 32;
/** No list in a lesson file is longer; stops a hostile file from making us walk millions. */
const MAX_ITEMS = 2000;
/** Ids as the checker writes them: lesson `B1`, participants and steps `attacker`, `glue`. */
const LESSON_ID = /^[A-Z][0-9]{1,2}$/;
const LANGUAGE = /^[a-z]{2,3}$/;
const HASH = /^[0-9a-f]{8}$/;
const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical'];
const KINDS: readonly MessageKind[] = ['legit', 'attack', 'safe'];
const MODES: readonly StepMode[] = ['both', 'with-defence', 'without-defence'];

/** Thrown only inside this module and always caught by `read`. */
class Bad extends Error {}

function fail(path: string, expected: string): never {
  throw new Bad(`${path === '' ? '(top)' : path}: expected ${expected}`);
}

function read<T>(input: unknown, reader: (input: unknown) => T): ReadResult<T> {
  try {
    return { ok: true, value: reader(input) };
  } catch (error) {
    // A RangeError (stack) is impossible with the depth limit, but bad data is still bad data.
    const message = error instanceof Bad ? error.message : 'unreadable data';
    return { ok: false, error: { code: 'bad-data', message } };
  }
}

// ---------------------------------------------------------------------------------------------
// Primitives

type Fields = Readonly<Record<string, unknown>>;

function object(input: unknown, path: string): Fields {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(path, 'an object');
  return input as Fields;
}

/** An own field only, so `__proto__` and inherited names never answer. */
function field(o: Fields, name: string): unknown {
  return Object.hasOwn(o, name) ? o[name] : undefined;
}

function str(o: Fields, name: string, path: string): string {
  const value = field(o, name);
  if (typeof value !== 'string') fail(`${path}.${name}`, 'text');
  return value;
}

function strOrNull(o: Fields, name: string, path: string): string | null {
  return field(o, name) === null ? null : str(o, name, path);
}

function bool(o: Fields, name: string, path: string): boolean {
  const value = field(o, name);
  if (typeof value !== 'boolean') fail(`${path}.${name}`, 'true or false');
  return value;
}

function oneOf<T extends string>(o: Fields, name: string, path: string, values: readonly T[]): T {
  const value = field(o, name);
  const found = values.find((v) => v === value);
  if (found === undefined) fail(`${path}.${name}`, `one of ${values.join(', ')}`);
  return found;
}

function matching(o: Fields, name: string, path: string, pattern: RegExp): string {
  const value = str(o, name, path);
  if (!pattern.test(value)) fail(`${path}.${name}`, `text like ${pattern.source}`);
  return value;
}

function list<T>(
  input: unknown,
  path: string,
  item: (value: unknown, path: string) => T,
): readonly T[] {
  if (!Array.isArray(input)) fail(path, 'a list');
  const items: readonly unknown[] = input;
  if (items.length > MAX_ITEMS) fail(path, `at most ${String(MAX_ITEMS)} items`);
  return items.map((value, i) => item(value, `${path}[${String(i)}]`));
}

function listField<T>(
  o: Fields,
  name: string,
  path: string,
  item: (value: unknown, path: string) => T,
): readonly T[] {
  return list(field(o, name), `${path}.${name}`, item);
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'text');
  return value;
}

// ---------------------------------------------------------------------------------------------
// Text tree

function inline(input: unknown, path: string, depth: number): SiteInline {
  if (depth > MAX_TEXT_DEPTH) fail(path, `text nested at most ${String(MAX_TEXT_DEPTH)} deep`);
  const o = object(input, path);
  const type = field(o, 'type');
  switch (type) {
    case 'text':
    case 'code':
      return { type, value: str(o, 'value', path) };
    case 'break':
      return { type };
    case 'strong':
    case 'emphasis':
      return {
        type,
        children: listField(o, 'children', path, (v, p) => inline(v, p, depth + 1)),
      };
    default:
      return fail(`${path}.type`, 'text, code, break, strong or emphasis');
  }
}

function segment(input: unknown, path: string): SiteCodeSegment {
  const o = object(input, path);
  return { text: str(o, 'text', path), marked: bool(o, 'marked', path) };
}

function code(input: unknown, path: string): SiteCode {
  const o = object(input, path);
  if (field(o, 'type') !== 'code') fail(`${path}.type`, 'code');
  return {
    type: 'code',
    lang: str(o, 'lang', path),
    segments: listField(o, 'segments', path, segment),
  };
}

function block(input: unknown, path: string, depth: number): SiteBlock {
  if (depth > MAX_TEXT_DEPTH) fail(path, `text nested at most ${String(MAX_TEXT_DEPTH)} deep`);
  const o = object(input, path);
  switch (field(o, 'type')) {
    case 'paragraph':
      return {
        type: 'paragraph',
        children: listField(o, 'children', path, (v, p) => inline(v, p, depth + 1)),
      };
    case 'list':
      return {
        type: 'list',
        ordered: bool(o, 'ordered', path),
        items: listField(o, 'items', path, (item, p) =>
          list(item, p, (v, q) => block(v, q, depth + 1)),
        ),
      };
    case 'code':
      return code(o, path);
    default:
      return fail(`${path}.type`, 'paragraph, list or code');
  }
}

function blocks(input: unknown, path: string): readonly SiteBlock[] {
  return list(input, path, (v, p) => block(v, p, 0));
}

// ---------------------------------------------------------------------------------------------
// Lesson

function passport(input: unknown, path: string): SitePassport {
  const o = object(input, path);
  const severity = field(o, 'severity');
  return {
    cwe: listField(o, 'cwe', path, (v, p) => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) fail(p, 'a CWE number');
      return v;
    }),
    owasp: listField(o, 'owasp', path, text),
    attack: listField(o, 'attack', path, text),
    cvss: strOrNull(o, 'cvss', path),
    cves: listField(o, 'cves', path, text),
    severity: severity === null ? null : oneOf(o, 'severity', path, SEVERITIES),
    impact: strOrNull(o, 'impact', path),
    defence: strOrNull(o, 'defence', path),
    class: strOrNull(o, 'class', path),
  };
}

function source(input: unknown, path: string): SiteSource {
  const o = object(input, path);
  const url = str(o, 'url', path);
  if (!url.startsWith('https://')) fail(`${path}.url`, 'an https:// link');
  return { title: str(o, 'title', path), url };
}

function participant(input: unknown, path: string): SiteParticipant {
  const o = object(input, path);
  return {
    id: str(o, 'id', path),
    name: str(o, 'name', path),
    note: str(o, 'note', path),
    icon: str(o, 'icon', path),
  };
}

function zone(input: unknown, path: string, ids: ReadonlySet<string>): SiteZone {
  const o = object(input, path);
  return {
    id: str(o, 'id', path),
    label: str(o, 'label', path),
    members: listField(o, 'members', path, (v, p) => known(text(v, p), p, ids)),
    danger: bool(o, 'danger', path),
  };
}

function unique<T extends { readonly id: string }>(
  items: readonly T[],
  path: string,
): readonly T[] {
  if (new Set(items.map((x) => x.id)).size !== items.length) fail(path, 'each id once');
  return items;
}

/**
 * The scene draws a zone as one frame over neighbouring participants (M1.2b, K19): a member
 * given twice, a participant in two zones (nested or overlapping zones) and members with a gap
 * between them are bad data, as the lesson checker already says for the source files.
 */
function oneFrameEach(zones: readonly SiteZone[], order: readonly string[]): readonly SiteZone[] {
  const taken = new Set<string>();
  zones.forEach((z, i) => {
    const path = `zones.${String(i)}.members`;
    const places = z.members.map((m) => order.indexOf(m)).sort((a, b) => a - b);
    if (new Set(places).size !== places.length) fail(path, 'each member once');
    const first = places[0] ?? 0;
    if (places.some((place, k) => place !== first + k)) fail(path, 'neighbours in the line');
    for (const m of z.members) {
      if (taken.has(m)) fail(path, 'participants in no other zone');
      taken.add(m);
    }
  });
  return zones;
}

function known(id: string, path: string, ids: ReadonlySet<string>): string {
  if (!ids.has(id)) fail(path, 'the id of a participant');
  return id;
}

function levels(input: unknown, path: string): SiteLevels {
  const o = object(input, path);
  return {
    simple: blocks(field(o, 'simple'), `${path}.simple`),
    detailed: blocks(field(o, 'detailed'), `${path}.detailed`),
    deep: blocks(field(o, 'deep'), `${path}.deep`),
  };
}

function step(input: unknown, path: string, ids: ReadonlySet<string>): SiteStep {
  const o = object(input, path);
  const stepCode = field(o, 'code');
  return {
    id: str(o, 'id', path),
    title: str(o, 'title', path),
    from: known(str(o, 'from', path), `${path}.from`, ids),
    to: known(str(o, 'to', path), `${path}.to`, ids),
    kind: oneOf(o, 'kind', path, KINDS),
    mode: oneOf(o, 'mode', path, MODES),
    stopped: bool(o, 'stopped', path),
    icon: strOrNull(o, 'icon', path),
    message: str(o, 'message', path),
    result: str(o, 'result', path),
    code: stepCode === null ? null : code(stepCode, `${path}.code`),
    levels: levels(field(o, 'levels'), `${path}.levels`),
  };
}

function wave(o: Fields, path: string): number {
  const value = field(o, 'wave');
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3) {
    fail(at(path, 'wave'), 'a wave 1, 2 or 3');
  }
  return value;
}

function at(path: string, name: string): string {
  return path === '' ? name : `${path}.${name}`;
}

function lesson(input: unknown, want: { id: string; language: string }): SiteLesson {
  const o = object(input, '');
  if (field(o, 'format') !== SITE_FORMAT) fail('format', `format ${String(SITE_FORMAT)}`);
  const id = field(o, 'id');
  if (id !== want.id) fail('id', `the lesson ${want.id}`);
  const language = field(o, 'language');
  if (language !== want.language) fail('language', `the language ${want.language}`);
  const participants = unique(
    list(field(o, 'participants'), 'participants', participant),
    'participants',
  );
  const ids = new Set(participants.map((p) => p.id));
  const defence = field(o, 'defence');
  const title = field(o, 'title');
  const section = field(o, 'section');
  if (typeof title !== 'string') fail('title', 'text');
  if (typeof section !== 'string') fail('section', 'text');
  return {
    format: SITE_FORMAT,
    id: want.id,
    section,
    wave: wave(o, ''),
    language: want.language,
    title,
    passport: passport(field(o, 'passport'), 'passport'),
    sources: list(field(o, 'sources'), 'sources', source),
    participants,
    zones: oneFrameEach(
      unique(
        list(field(o, 'zones'), 'zones', (v, p) => zone(v, p, ids)),
        'zones',
      ),
      participants.map((p) => p.id),
    ),
    steps: unique(
      list(field(o, 'steps'), 'steps', (v, p) => step(v, p, ids)),
      'steps',
    ),
    defence: defence === null ? null : blocks(defence, 'defence'),
  };
}

/**
 * Reads one lesson file. `want` is the lesson asked for: a file of another lesson or language
 * (swapped on the server or in a cache) is bad data.
 */
export function readSiteLesson(
  input: unknown,
  want: { readonly id: string; readonly language: string },
): ReadResult<SiteLesson> {
  return read(input, (value) => lesson(value, want));
}

// ---------------------------------------------------------------------------------------------
// Catalog

function translation(input: unknown, path: string): SiteTranslation {
  const o = object(input, path);
  return {
    language: matching(o, 'language', path, LANGUAGE),
    title: str(o, 'title', path),
    hash: matching(o, 'hash', path, HASH),
  };
}

function entry(input: unknown, path: string): SiteCatalogEntry {
  const o = object(input, path);
  const translations = listField(o, 'translations', path, translation);
  if (translations.length === 0) fail(at(path, 'translations'), 'at least one language');
  const languages = new Set(translations.map((t) => t.language));
  if (languages.size !== translations.length) fail(at(path, 'translations'), 'each language once');
  return {
    id: matching(o, 'id', path, LESSON_ID),
    section: str(o, 'section', path),
    wave: wave(o, path),
    translations,
  };
}

function catalog(input: unknown): SiteCatalog {
  const o = object(input, '');
  if (field(o, 'format') !== SITE_FORMAT) fail('format', `format ${String(SITE_FORMAT)}`);
  const lessons = list(field(o, 'lessons'), 'lessons', entry);
  if (new Set(lessons.map((l) => l.id)).size !== lessons.length)
    fail('lessons', 'each lesson once');
  return { format: SITE_FORMAT, lessons };
}

/** Reads the catalog file. */
export function readCatalog(input: unknown): ReadResult<SiteCatalog> {
  return read(input, catalog);
}
