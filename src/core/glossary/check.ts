/**
 * The glossary checker (M2.4, K98; split into files in G17, K133): the folder
 * `content/locales/<lang>/glossary/` → `Glossary`, or errors as data with file and line, like the
 * lesson checker (it reuses its reporter, limits and text rules). The folder holds `index.md`
 * (title, header, categories) and one file per category, `<category>.md`, continued in
 * `<category>.2.md` … `<category>.9.md`. Each file has the limits of a lesson file (64 KB, 1000
 * lines); ids, forms and «see» are checked across all files of a language. Pure: strings in,
 * data out, never throws. The format: README.md.
 */
import type { Heading, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { findForeignAddresses } from '../lesson/addresses';
import type { ContentFile } from '../lesson/check';
import { normaliseText, preflight } from '../lesson/check';
import { BASE_LANGUAGE } from '../lesson/headings';
import type { IdWord } from '../lesson/ids';
import { unknownId } from '../lesson/ids';
import { ID } from '../lesson/parse';
import type { Reporter } from '../lesson/report';
import { START, capReported, createLocator, createReporter, quote } from '../lesson/report';
import { blocks, checkPlainLine, positionOf } from '../lesson/text';
import type { Lesson, LessonError, Position } from '../lesson/types';
import { normaliseForm } from './match';
import { MAX_GLOSSARY_TERMS } from './site';
import type { Glossary, GlossaryCategory, GlossaryTerm } from './types';
import { glossaryLanguages, glossaryWordsFor, type GlossaryWords } from './words';

/** The most terms of one language, in all its files (G17; 300 in one file before). */
export const MAX_TERMS = MAX_GLOSSARY_TERMS;
export const MAX_CATEGORIES = 20;
/** Files in one glossary folder: more is a hostile pull request (20 categories × 9 files + index). */
export const MAX_GLOSSARY_FILES = 200;
export const MAX_FORMS = 40;
export const MAX_FORM_LENGTH = 60;
export const MAX_TITLE_LENGTH = 60;
/** A definition is short: two or three sentences, in characters of the source. */
export const MAX_DEFINITION_CHARS = 700;

/** Anything named glossary under a language folder: the folder or the old single file. */
const GLOSSARY_ANY = /^content\/locales\/([a-z]{2,3})\/glossary(\.md|\/(.*))$/;
/** A category file: `web.md`, or a continuation `web.2.md` … `web.9.md`. */
const PART_NAME = /^([a-z][a-z0-9-]{0,31})(?:\.([2-9]))?\.md$/;
const INDEX_NAME = 'index.md';
const LESSON_PATH = /^content\/lessons\/([A-Z][0-9]{1,2})\/([a-z]{2,3})\.md$/;
const LESSON_ID = /^[A-Z][0-9]{1,2}$/;
/** A form: words of letters and digits, with spaces, hyphens, `&`, `.` and apostrophes inside. */
const FORM = /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}&'’. -]*[\p{L}\p{M}\p{N}])?$/u;
const ID_HINT = 'lowercase Latin letters, digits and hyphens, starting with a letter';

/** The glossary folder of a language. */
export function glossaryDir(language: string): string {
  return `content/locales/${language}/glossary`;
}

/** The index of a language's glossary: title, header and categories. */
export function glossaryIndexPath(language: string): string {
  return `${glossaryDir(language)}/${INDEX_NAME}`;
}

interface Ctx {
  readonly path: string;
  readonly text: string;
  readonly reporter: Reporter;
  readonly words: GlossaryWords;
}

function raw(ctx: Ctx, node: RootContent): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? '' : ctx.text.slice(start, end);
}

function flat(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim();
}

/** Heading text; markup other than `code` shows as U+FFFD and never matches. */
function headingText(node: Heading): string {
  return node.children
    .map((c) => (c.type === 'text' ? c.value : c.type === 'inlineCode' ? `\`${c.value}\`` : '�'))
    .join('')
    .trim();
}

function list(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

function idOk(ctx: Ctx, at: Position, path: string, what: string, id: string): boolean {
  if (ID.test(id)) return true;
  ctx.reporter.add(at, path, 'bad-value', `${what} \`${quote(id, 32)}\` must be ${ID_HINT}`);
  return false;
}

// ---------------------------------------------------------------------------------------------
// Parts of a file

function parseHeader(ctx: Ctx, node: RootContent | undefined, want: string): void {
  const at = node === undefined ? START : positionOf(node);
  if (node?.type !== 'paragraph' || flat(raw(ctx, node)) !== want) {
    ctx.reporter.add(at, 'header', 'bad-header', `the second line must be ${want}`);
  }
}

function parseCategories(ctx: Ctx, nodes: readonly RootContent[]): GlossaryCategory[] {
  const out: GlossaryCategory[] = [];
  for (const node of nodes) {
    if (node.type !== 'list' || node.ordered === true) {
      ctx.reporter.add(
        positionOf(node),
        'categories',
        'stray-content',
        'only a "- " list is allowed here: - `web` Веб',
      );
      continue;
    }
    for (const item of node.children) {
      const at = positionOf(item);
      const p = item.children[0];
      if (item.children.length !== 1 || p?.type !== 'paragraph') {
        ctx.reporter.add(at, 'categories', 'bad-line', 'a category line looks like - `web` Веб');
        continue;
      }
      if (!checkPlainLine(p.children, ctx.reporter, 'categories', { code: true })) continue;
      const match = /^`([^`]*)`\s+([^`]+)$/.exec(flat(raw(ctx, p)));
      if (match === null) {
        ctx.reporter.add(at, 'categories', 'bad-line', 'a category line looks like - `web` Веб');
        continue;
      }
      const [, id = '', label = ''] = match;
      if (!idOk(ctx, at, `categories.${quote(id, 32)}`, 'category id', id)) continue;
      if (id === 'index') {
        ctx.reporter.add(
          at,
          `categories.${id}`,
          'bad-value',
          'a category cannot be called `index`: index.md is the list of categories',
        );
        continue;
      }
      if (out.some((c) => c.id === id)) {
        ctx.reporter.add(at, `categories.${id}`, 'duplicate', `category \`${id}\` is listed twice`);
        continue;
      }
      out.push({ id, label: label.trim(), position: at });
    }
  }
  if (out.length > MAX_CATEGORIES) {
    ctx.reporter.add(
      START,
      'categories',
      'too-large',
      `at most ${String(MAX_CATEGORIES)} categories`,
    );
  }
  return out;
}

interface ServiceLine {
  category: string | null;
  see: string[];
  lessons: string[];
}

function parseService(ctx: Ctx, p: Paragraph, path: string): ServiceLine | null {
  const at = positionOf(p);
  const hint = '`category` web · `see` query, database · `lessons` B1 (see and lessons optional)';
  if (!checkPlainLine(p.children, ctx.reporter, path, { code: true })) return null;
  const out: ServiceLine = { category: null, see: [], lessons: [] };
  const seen = new Set<string>();
  for (const part of flat(raw(ctx, p)).split(' · ')) {
    const match = /^`([a-z]+)`\s+([^`]+)$/.exec(part.trim());
    if (match === null) {
      ctx.reporter.add(at, path, 'bad-line', `the line under a term looks like ${hint}`);
      return null;
    }
    const [, word = '', value = ''] = match;
    if (seen.has(word)) {
      ctx.reporter.add(at, path, 'duplicate', `\`${word}\` is given twice`);
      return null;
    }
    seen.add(word);
    if (word === 'category') {
      const id = value.trim();
      if (!idOk(ctx, at, path, 'category', id)) return null;
      out.category = id;
    } else if (word === 'see') {
      out.see = list(value);
      for (const id of out.see) if (!idOk(ctx, at, path, 'term id in `see`', id)) return null;
    } else if (word === 'lessons') {
      out.lessons = list(value);
      for (const id of out.lessons) {
        if (!LESSON_ID.test(id)) {
          ctx.reporter.add(
            at,
            path,
            'bad-value',
            `lesson id \`${quote(id, 32)}\` must look like B1`,
          );
          return null;
        }
      }
    } else {
      ctx.reporter.add(
        at,
        path,
        'unknown-word',
        `unknown word \`${quote(word, 32)}\`; the line looks like ${hint}`,
      );
      return null;
    }
  }
  if (out.category === null) {
    ctx.reporter.add(at, path, 'bad-line', `a term needs \`category\`: ${hint}`);
    return null;
  }
  return out;
}

function parseForms(ctx: Ctx, p: Paragraph, path: string): string[] | null {
  if (!checkPlainLine(p.children, ctx.reporter, path, {})) return null;
  const line = flat(raw(ctx, p));
  const value = line.slice(ctx.words.forms.length + 1);
  const at = positionOf(p);
  if (value.trim() !== '' && value.split(',').some((f) => f.trim() === '')) {
    ctx.reporter.add(at, path, 'bad-value', 'an empty form between commas: write form, form, form');
    return null;
  }
  const forms = list(value);
  if (forms.length === 0) {
    ctx.reporter.add(
      at,
      path,
      'empty-section',
      `${ctx.words.forms}: lists at least one form; drop the line for a term found only on the scene`,
    );
    return null;
  }
  if (forms.length > MAX_FORMS) {
    ctx.reporter.add(at, path, 'too-large', `at most ${String(MAX_FORMS)} forms per term`);
    return null;
  }
  for (const form of forms) {
    if (form.length > MAX_FORM_LENGTH || !FORM.test(form) || /\s{2}/.test(form)) {
      ctx.reporter.add(
        at,
        path,
        'bad-value',
        `form "${quote(form, 40)}" must be plain words (letters, digits, spaces, - & . '), at most ${String(MAX_FORM_LENGTH)} characters; patterns are not allowed`,
      );
      return null;
    }
  }
  return forms;
}

function startsForms(ctx: Ctx, node: RootContent | undefined): node is Paragraph {
  if (node?.type !== 'paragraph') return false;
  const first: PhrasingContent | undefined = node.children[0];
  return first?.type === 'text' && first.value.startsWith(`${ctx.words.forms}:`);
}

function parseTerm(ctx: Ctx, heading: Heading, body: readonly RootContent[]): GlossaryTerm | null {
  const at = positionOf(heading);
  if (!checkPlainLine(heading.children, ctx.reporter, 'terms', { code: true })) return null;
  const match = /^`([^`]*)`\s+([^`]+)$/.exec(headingText(heading));
  if (match === null) {
    ctx.reporter.add(at, 'terms', 'bad-line', 'a term starts with ## `id` Title');
    return null;
  }
  const [, id = '', titleRaw = ''] = match;
  const title = titleRaw.trim();
  const path = `terms.${quote(id, 32)}`;
  if (!idOk(ctx, at, path, 'term id', id)) return null;
  if (title.length > MAX_TITLE_LENGTH) {
    ctx.reporter.add(
      at,
      path,
      'too-large',
      `a title is at most ${String(MAX_TITLE_LENGTH)} characters`,
    );
    return null;
  }
  const [first, ...rest] = body;
  if (first?.type !== 'paragraph') {
    ctx.reporter.add(
      at,
      path,
      'bad-line',
      'under the term heading comes the line `category` web · `see` … · `lessons` …',
    );
    return null;
  }
  const service = parseService(ctx, first, path);
  let forms: string[] = [];
  let text = rest;
  if (startsForms(ctx, rest[0])) {
    forms = parseForms(ctx, rest[0], path) ?? [];
    text = rest.slice(1);
  }
  if (text.length === 0) {
    ctx.reporter.add(at, path, 'empty-section', `term \`${id}\` has no definition`);
    return null;
  }
  const lastNode = text[text.length - 1];
  const from = text[0]?.position?.start.offset ?? 0;
  const to = lastNode?.position?.end.offset ?? from;
  if (to - from > MAX_DEFINITION_CHARS) {
    ctx.reporter.add(
      positionOf(text[0] ?? heading),
      path,
      'too-large',
      `the definition is ${String(to - from)} characters; a definition is at most ${String(MAX_DEFINITION_CHARS)}: keep it short`,
    );
  }
  const definition = blocks(text, ctx.reporter, path);
  if (service === null) return null;
  return {
    id,
    title,
    category: service.category ?? '',
    forms,
    see: service.see,
    lessons: service.lessons,
    definition,
    file: ctx.path,
    position: at,
  };
}

interface Section {
  readonly heading: Heading;
  readonly body: RootContent[];
}

/** `nodes` split at `##` headings; anything before the first one is reported as `stray`. */
function sectionsOf(ctx: Ctx, nodes: readonly RootContent[], stray: string): Section[] {
  const sections: Section[] = [];
  for (const node of nodes) {
    if (node.type === 'heading' && node.depth === 2) sections.push({ heading: node, body: [] });
    else {
      const last = sections[sections.length - 1];
      if (last === undefined) ctx.reporter.add(positionOf(node), '', 'stray-content', stray);
      else last.body.push(node);
    }
  }
  return sections;
}

interface IndexData {
  readonly title: string;
  readonly categories: readonly GlossaryCategory[];
}

/** index.md: `# Словарь`, the header with `format` 2 and `## Разделы`; nothing else. */
function parseIndex(ctx: Ctx, root: Root, language: string): IndexData {
  const nodes = root.children;
  const head = nodes[0];
  let title = '';
  if (head?.type === 'heading' && head.depth === 1 && headingText(head) === ctx.words.title) {
    title = headingText(head);
  } else {
    ctx.reporter.add(
      head === undefined ? START : positionOf(head),
      'title',
      'missing-title',
      `the file starts with # ${ctx.words.title}`,
    );
  }
  parseHeader(ctx, nodes[1], `\`glossary\` ${language} · \`format\` 2`);
  const [first, ...rest] = sectionsOf(
    ctx,
    nodes.slice(2),
    `text before ## ${ctx.words.categories}`,
  );
  let categories: GlossaryCategory[] = [];
  if (first !== undefined && headingText(first.heading) === ctx.words.categories) {
    categories = parseCategories(ctx, first.body);
  } else {
    ctx.reporter.add(
      first === undefined ? START : positionOf(first.heading),
      'categories',
      'missing-section',
      `after the header comes ## ${ctx.words.categories} with the list of categories`,
    );
  }
  for (const section of rest) {
    ctx.reporter.add(
      positionOf(section.heading),
      '',
      'stray-content',
      `index.md holds only the categories; terms live in one file per category: ${glossaryDir(language)}/<category>.md`,
    );
  }
  return { title, categories };
}

/**
 * The head of a category file: `# <label of the category>`, the header
 * `` `glossary` ru · `category` web ``, then the term sections. `label` is null when index.md is
 * broken: the title is then not compared.
 */
function parsePartHead(
  ctx: Ctx,
  root: Root,
  language: string,
  category: string,
  label: string | null,
): Section[] {
  const nodes = root.children;
  const head = nodes[0];
  const isTitle = head?.type === 'heading' && head.depth === 1;
  if (!isTitle || (label !== null && headingText(head) !== label)) {
    ctx.reporter.add(
      head === undefined ? START : positionOf(head),
      'title',
      'missing-title',
      label === null
        ? 'the file starts with # and the label of its category'
        : `the file starts with # ${label}, the label of \`${category}\` in index.md`,
    );
  }
  parseHeader(ctx, nodes[1], `\`glossary\` ${language} · \`category\` ${category}`);
  return sectionsOf(
    ctx,
    nodes.slice(2),
    'text before the first term: a term starts with ## `id` Title',
  );
}

// ---------------------------------------------------------------------------------------------
// One file: text, limits, Markdown

/** The file as text and Markdown, or null with the reasons in `reporter`. */
function readFile(file: ContentFile, reporter: Reporter): { text: string; root: Root } | null {
  if (typeof file.text !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return null;
  }
  const text = normaliseText(file.text);
  const limit = preflight(text, 'a glossary file');
  if (limit !== null) {
    reporter.add({ line: limit.line, column: 1 }, '', limit.code, limit.message);
    return null;
  }
  let root: Root;
  try {
    root = fromMarkdown(text);
  } catch {
    reporter.add(START, '', 'parse-failed', 'cannot read the file as Markdown');
    return null;
  }
  // Invisible characters that change what a reader sees (NUL, bidirectional overrides and
  // isolates) are never allowed: the text must read as it is written.
  const locateHidden = createLocator(text);
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 0 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) {
      reporter.add(
        locateHidden(i),
        'text',
        'not-allowed',
        `the invisible character U+${c.toString(16).toUpperCase().padStart(4, '0')} is not allowed`,
      );
    }
  }
  return reporter.total() > 0 ? null : { text, root };
}

/** L4.2 and L5 over the whole text of a file: documentation addresses, vetted ids. */
function checkFileText(text: string, reporter: Reporter): void {
  const locate = createLocator(text);
  for (const found of findForeignAddresses(text)) {
    reporter.add(
      locate(found.index),
      'text',
      'address',
      found.kind === 'ip'
        ? `address ${quote(found.value, 45)} is not in a documentation range (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32)`
        : `domain ${quote(found.value, 80)} is not a documentation name (example.com, example.org, example.net, *.example, *.test)`,
    );
  }
  checkIds(text, reporter, locate);
}

/**
 * L5 (M2.8, K86): a CWE, ATT&CK technique, OWASP item or CVE named anywhere in the glossary is in
 * the vetted lists of src/core/lesson/ids.ts, as in a lesson passport.
 */
const MENTIONED_IDS: readonly { word: IdWord; pattern: RegExp }[] = [
  { word: 'cwe', pattern: /(?<![\w-])CWE-(\d{1,6})(?![\w-])/g },
  { word: 'attack', pattern: /(?<![\w-])(T\d{4}(?:\.\d{3})?)(?!\.\d|[\w-])/g },
  { word: 'owasp', pattern: /(?<![\w-])((?:A|LLM)\d{2}:\d{4})(?![\w-])/g },
  { word: 'cves', pattern: /(?<![\w-])(CVE-\d{4}-\d{4,7})(?![\w-])/g },
];

function checkIds(text: string, reporter: Reporter, locate: (index: number) => Position): void {
  for (const { word, pattern } of MENTIONED_IDS) {
    for (const m of text.matchAll(pattern)) {
      const problem = unknownId(word, m[1] ?? '');
      if (problem !== null) reporter.add(locate(m.index), 'text', 'unknown-id', problem);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// One language: index.md and the category files, checked together

interface Part {
  readonly file: ContentFile;
  readonly path: string;
  readonly name: string;
  readonly category: string;
  /** 1 for `web.md`, 2–9 for `web.2.md` … */
  readonly n: number;
}

interface LanguageFiles {
  index: { readonly file: ContentFile; readonly path: string } | null;
  readonly parts: Part[];
}

type Reporters = (path: string) => Reporter;

function checkLanguage(
  language: string,
  words: GlossaryWords,
  files: LanguageFiles,
  lessonIds: ReadonlySet<string>,
  rep: Reporters,
): Glossary | null {
  const indexPath = glossaryIndexPath(language);
  const used: Reporter[] = [];
  const use = (path: string): Reporter => {
    const r = rep(path);
    if (!used.includes(r)) used.push(r);
    return r;
  };

  let index: IndexData | null = null;
  if (files.index !== null) {
    const reporter = use(indexPath);
    const read = readFile(files.index.file, reporter);
    if (read !== null) {
      index = parseIndex(
        { path: indexPath, text: read.text, reporter, words },
        read.root,
        language,
      );
      checkFileText(read.text, reporter);
    }
  }
  const order = new Map((index?.categories ?? []).map((c, i) => [c.id, i]));
  const labels = new Map((index?.categories ?? []).map((c) => [c.id, c.label]));
  const parts = [...files.parts].sort(
    (a, b) =>
      (order.get(a.category) ?? Infinity) - (order.get(b.category) ?? Infinity) ||
      (a.category < b.category ? -1 : a.category > b.category ? 1 : 0) ||
      a.n - b.n,
  );

  // Heads of the category files, and the cap on terms before any term is parsed.
  const read: { ctx: Ctx; part: Part; sections: Section[] }[] = [];
  let count = 0;
  let capped = false;
  for (const part of parts) {
    const reporter = use(part.path);
    if (index !== null && !order.has(part.category)) {
      reporter.add(
        START,
        '',
        'bad-path',
        `\`${quote(part.category, 32)}\` is not a category in ${indexPath}; a category file is named after a category id listed there`,
      );
      continue;
    }
    const file = readFile(part.file, reporter);
    if (file === null) continue;
    const ctx: Ctx = { path: part.path, text: file.text, reporter, words };
    const label = index === null ? null : (labels.get(part.category) ?? null);
    const sections = parsePartHead(ctx, file.root, language, part.category, label);
    checkFileText(file.text, reporter);
    if (count + sections.length > MAX_TERMS) {
      const over = sections[MAX_TERMS - count];
      reporter.add(
        over === undefined ? START : positionOf(over.heading),
        'terms',
        'too-large',
        `the glossary has more than ${String(MAX_TERMS)} terms in its files; at most ${String(MAX_TERMS)}`,
      );
      capped = true;
      break;
    }
    count += sections.length;
    read.push({ ctx, part, sections });
  }
  if (capped) return null;

  // Terms, with ids and forms unique in the whole language.
  const terms: GlossaryTerm[] = [];
  const byId = new Map<string, GlossaryTerm>();
  for (const { ctx, part, sections } of read) {
    for (const { heading, body } of sections) {
      const term = parseTerm(ctx, heading, body);
      if (term === null) continue;
      const path = `terms.${term.id}`;
      if (term.category !== part.category) {
        ctx.reporter.add(
          term.position,
          path,
          'bad-value',
          index !== null && !order.has(term.category)
            ? `category \`${term.category}\` is not in ## ${words.categories} of ${indexPath}`
            : `term \`${term.id}\` says \`category\` ${term.category} but is in ${part.name}: move it to ${term.category}.md`,
        );
      }
      const first = byId.get(term.id);
      if (first !== undefined) {
        ctx.reporter.add(
          term.position,
          path,
          'duplicate',
          `term \`${term.id}\` is listed twice: first at ${first.file}:${String(first.position.line)}`,
        );
        continue;
      }
      byId.set(term.id, term);
      terms.push(term);
    }
  }
  checkLinks(terms, rep);
  for (const term of terms) {
    for (const id of term.lessons) {
      if (!lessonIds.has(id)) {
        rep(term.file).add(
          term.position,
          `terms.${term.id}`,
          'unknown-lesson',
          `\`lessons\` names ${id}, which is not in content/lessons`,
        );
      }
    }
  }
  if (index === null || used.some((r) => r.total() > 0)) return null;
  return { language, title: index.title, index: indexPath, categories: index.categories, terms };
}

/** «См. также» and forms, across all files: they point at things that exist and say one thing each. */
function checkLinks(terms: readonly GlossaryTerm[], rep: Reporters): void {
  const ids = new Set(terms.map((t) => t.id));
  const owner = new Map<string, string>();
  for (const term of terms) {
    const reporter = rep(term.file);
    const path = `terms.${term.id}`;
    for (const id of term.see) {
      if (id === term.id)
        reporter.add(term.position, path, 'bad-value', `term \`${id}\` names itself in \`see\``);
      else if (!ids.has(id))
        reporter.add(
          term.position,
          path,
          'unknown-term',
          `\`see\` names \`${id}\`, which is not in the glossary`,
        );
    }
    if (new Set(term.see).size !== term.see.length) {
      reporter.add(term.position, path, 'duplicate', '`see` names a term twice');
    }
    if (new Set(term.lessons).size !== term.lessons.length) {
      reporter.add(term.position, path, 'duplicate', '`lessons` names a lesson twice');
    }
    for (const form of term.forms) {
      const key = normaliseForm(form);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, term.id);
      else if (other !== term.id) {
        reporter.add(
          term.position,
          path,
          'duplicate',
          `form "${quote(form, 40)}" belongs to \`${other}\` too; a form names one term`,
        );
      } else {
        reporter.add(term.position, path, 'duplicate', `form "${quote(form, 40)}" is listed twice`);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// All glossaries, against the lessons

export interface GlossaryContext {
  /** Lessons that passed the lesson checker: their `term:` words are checked here. */
  readonly lessons: readonly Lesson[];
  /** Paths of all lesson files, checked or not: lesson ids and languages come from them. */
  readonly lessonPaths: readonly string[];
  /** The languages of the site (content/locales/languages.md, K94): each needs a glossary. */
  readonly siteLanguages?: readonly string[];
}

export interface GlossaryResult {
  /** Glossaries without errors. */
  readonly glossaries: readonly Glossary[];
  readonly errors: readonly LessonError[];
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** A translation has the same categories and files, and in each file the same terms in order. */
function compare(base: Glossary, other: Glossary): LessonError[] {
  const reporters = new Map<string, Reporter>();
  const rep = (path: string): Reporter => {
    const known = reporters.get(path);
    if (known !== undefined) return known;
    const r = createReporter(path);
    reporters.set(path, r);
    return r;
  };
  const baseDir = glossaryDir(base.language);
  const otherDir = glossaryDir(other.language);
  const cats = (g: Glossary) => g.categories.map((c) => c.id).join(', ');
  if (cats(base) !== cats(other)) {
    rep(other.index).add(
      other.categories[0]?.position ?? START,
      'categories',
      'translation-mismatch',
      `categories are ${cats(other)} here but ${cats(base)} in ${base.index}`,
    );
  }
  const group = (g: Glossary) => {
    const out = new Map<string, GlossaryTerm[]>();
    for (const t of g.terms) {
      const name = fileName(t.file);
      const list = out.get(name);
      if (list === undefined) out.set(name, [t]);
      else list.push(t);
    }
    return out;
  };
  const a = group(base);
  const b = group(other);
  const shape = (t: GlossaryTerm) =>
    `${t.id} [${t.category}; see ${t.see.join(',')}; lessons ${t.lessons.join(',')}]`;
  for (const name of [...a.keys(), ...[...b.keys()].filter((k) => !a.has(k))]) {
    const reporter = rep(`${otherDir}/${name}`);
    const as = a.get(name) ?? [];
    const bs = b.get(name) ?? [];
    if (bs.length === 0) {
      reporter.add(
        START,
        '',
        'translation-mismatch',
        `${baseDir}/${name} has ${String(as.length)} terms; a translation has the same files with the same terms`,
      );
      continue;
    }
    if (as.length === 0) {
      reporter.add(
        START,
        '',
        'translation-mismatch',
        `${baseDir} has no terms in ${name}; a translation has the same files with the same terms`,
      );
      continue;
    }
    const max = Math.max(as.length, bs.length);
    for (let i = 0; i < max; i += 1) {
      const x = as[i];
      const y = bs[i];
      if (x !== undefined && y !== undefined && shape(x) === shape(y)) continue;
      reporter.add(
        y?.position ?? START,
        `terms.${y?.id ?? x?.id ?? ''}`,
        'translation-mismatch',
        `term ${String(i + 1)} of ${name} is ${y === undefined ? 'missing' : shape(y)} here but ${x === undefined ? 'absent' : shape(x)} in ${baseDir}/${name}: the same ids, categories, see and lessons in the same order`,
      );
    }
  }
  return [...reporters.values()].flatMap(capReported);
}

/**
 * Checks every glossary folder, the translations against the Russian one, that each lesson
 * language has a glossary (K94), and the `term:` words of the lessons. `files` are the files
 * named glossary.md or under a glossary/ folder in content/locales.
 */
export function checkGlossaries(
  files: readonly ContentFile[],
  context: GlossaryContext,
): GlossaryResult {
  const lessonIds = new Set<string>();
  const lessonLanguages = new Set<string>();
  for (const path of context.lessonPaths) {
    const m = LESSON_PATH.exec(path);
    if (m === null) continue;
    lessonIds.add(m[1] ?? '');
    lessonLanguages.add(m[2] ?? '');
  }
  const reporters = new Map<string, Reporter>();
  const rep = (path: string): Reporter => {
    const known = reporters.get(path);
    if (known !== undefined) return known;
    const r = createReporter(path);
    reporters.set(path, r);
    return r;
  };

  // Files by language; anything else is a wrong path.
  const raw = new Map<string, { file: ContentFile; path: string; rest: string | null }[]>();
  for (const file of files) {
    const path = typeof file.path === 'string' ? file.path : '<not a file name>';
    const m = GLOSSARY_ANY.exec(path);
    if (m === null) {
      rep(path).add(
        START,
        '',
        'bad-path',
        'a glossary lives in content/locales/<language>/glossary/: index.md and one <category>.md per category',
      );
      continue;
    }
    const language = m[1] ?? '';
    const list = raw.get(language) ?? [];
    list.push({ file, path, rest: m[2] === '.md' ? null : (m[3] ?? '') });
    raw.set(language, list);
  }

  const byLanguage = new Map<string, LanguageFiles>();
  /** Languages whose files were looked at, with or without an index. */
  const present = new Set<string>();
  for (const [language, list] of raw) {
    present.add(language);
    if (list.length > MAX_GLOSSARY_FILES) {
      rep(glossaryDir(language)).add(
        START,
        '',
        'too-large',
        `${String(list.length)} files in the glossary of ${language}; at most ${String(MAX_GLOSSARY_FILES)}`,
      );
      continue;
    }
    if (glossaryWordsFor(language) === null) {
      for (const { path } of list) {
        rep(path).add(
          START,
          '',
          'unknown-language',
          `unknown language "${language}"; known: ${glossaryLanguages().join(', ')} (src/core/glossary/words.ts)`,
        );
      }
      continue;
    }
    const entry: LanguageFiles = { index: null, parts: [] };
    for (const { file, path, rest } of list) {
      if (rest === null) {
        rep(path).add(
          START,
          '',
          'bad-path',
          `the glossary is a folder now (G17): the title and categories go to ${glossaryIndexPath(language)}, the terms to ${glossaryDir(language)}/<category>.md`,
        );
        continue;
      }
      if (rest === INDEX_NAME) {
        if (entry.index !== null) rep(path).add(START, '', 'duplicate', 'a second index.md');
        else entry.index = { file, path };
        continue;
      }
      const part = PART_NAME.exec(rest);
      if (part === null) {
        rep(path).add(
          START,
          '',
          'bad-path',
          `a file of ${glossaryDir(language)} is index.md, <category>.md or <category>.<2–9>.md`,
        );
        continue;
      }
      const category = part[1] ?? '';
      entry.parts.push({
        file,
        path,
        name: rest,
        category,
        n: part[2] === undefined ? 1 : Number(part[2]),
      });
    }
    byLanguage.set(language, entry);
  }

  const checked = new Map<string, Glossary | null>();
  for (const [language, entry] of [...byLanguage].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const words = glossaryWordsFor(language);
    if (words === null) continue;
    checked.set(language, checkLanguage(language, words, entry, lessonIds, rep));
  }

  const languages = new Set([...lessonLanguages, ...present, ...(context.siteLanguages ?? [])]);
  if (languages.size > 0) languages.add(BASE_LANGUAGE);
  const missing: LessonError[] = [];
  for (const language of [...languages].sort()) {
    const entry = byLanguage.get(language);
    if (entry?.index !== undefined && entry.index !== null) continue;
    if (present.has(language) && entry === undefined) continue; // reported: too many files, unknown language
    const reporter = createReporter(glossaryIndexPath(language));
    reporter.add(
      START,
      '',
      'missing-glossary',
      `every site language has a glossary (K94): add ${glossaryIndexPath(language)}`,
    );
    missing.push(...reporter.errors);
  }
  const errors: LessonError[] = [...[...reporters.values()].flatMap(capReported), ...missing];

  const base = checked.get(BASE_LANGUAGE) ?? null;
  const glossaries: Glossary[] = [];
  for (const [language, glossary] of checked) {
    if (glossary === null) continue;
    if (language !== BASE_LANGUAGE) {
      if (base === null) continue; // ru has its own errors; compare once it is fixed
      const mismatch = compare(base, glossary);
      errors.push(...mismatch);
      if (mismatch.length > 0) continue;
    }
    glossaries.push(glossary);
  }

  // `term:` on participants and zones names a term of the lesson's own glossary.
  for (const lesson of context.lessons) {
    const glossary = checked.get(lesson.language);
    if (glossary === undefined || glossary === null) continue;
    const ids = new Set(glossary.terms.map((t) => t.id));
    const reporter = createReporter(`content/lessons/${lesson.id}/${lesson.language}.md`);
    const refs = [
      ...lesson.participants.map((p) => ({
        term: p.term,
        at: p.position,
        path: `participants.${p.id}`,
      })),
      ...lesson.zones.map((z) => ({ term: z.term, at: z.position, path: `zones.${z.id}` })),
    ];
    for (const ref of refs) {
      if (ref.term !== null && !ids.has(ref.term)) {
        reporter.add(
          ref.at,
          ref.path,
          'unknown-term',
          `\`term:${ref.term}\` is not in ${glossaryDir(lesson.language)}/`,
        );
      }
    }
    errors.push(...capReported(reporter));
  }
  return { glossaries, errors };
}
