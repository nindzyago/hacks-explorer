/**
 * The glossary checker (M2.4, K98): `content/locales/<lang>/glossary.md` → `Glossary`, or errors
 * as data with file and line, like the lesson checker (it reuses its reporter, limits and text
 * rules). Pure: strings in, data out, never throws. The format: README.md.
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
import type { Glossary, GlossaryCategory, GlossaryTerm } from './types';
import { glossaryLanguages, glossaryWordsFor, type GlossaryWords } from './words';

/** More terms than this is a hostile file; the prototype had 60. */
export const MAX_TERMS = 300;
export const MAX_CATEGORIES = 20;
export const MAX_FORMS = 40;
export const MAX_FORM_LENGTH = 60;
export const MAX_TITLE_LENGTH = 60;
/** A definition is short: two or three sentences, in characters of the source. */
export const MAX_DEFINITION_CHARS = 700;

const GLOSSARY_PATH = /^content\/locales\/([a-z]{2,3})\/glossary\.md$/;
const LESSON_PATH = /^content\/lessons\/([A-Z][0-9]{1,2})\/([a-z]{2,3})\.md$/;
const LESSON_ID = /^[A-Z][0-9]{1,2}$/;
/** A form: words of letters and digits, with spaces, hyphens, `&`, `.` and apostrophes inside. */
const FORM = /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}&'’. -]*[\p{L}\p{M}\p{N}])?$/u;
const ID_HINT = 'lowercase Latin letters, digits and hyphens, starting with a letter';

export function glossaryPath(language: string): string {
  return `content/locales/${language}/glossary.md`;
}

interface Ctx {
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
// Parts of the file

function parseHeader(ctx: Ctx, node: RootContent | undefined, language: string): void {
  const at = node === undefined ? START : positionOf(node);
  const want = `\`glossary\` ${language} · \`format\` 1`;
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
  const forms = list(value);
  const at = positionOf(p);
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
    position: at,
  };
}

function parseGlossary(ctx: Ctx, root: Root, language: string): Glossary {
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
  parseHeader(ctx, nodes[1], language);

  // The rest splits at `##` headings: the categories first, then one section per term.
  const sections: { heading: Heading; body: RootContent[] }[] = [];
  for (const node of nodes.slice(2)) {
    if (node.type === 'heading' && node.depth === 2) sections.push({ heading: node, body: [] });
    else {
      const last = sections[sections.length - 1];
      if (last === undefined) {
        ctx.reporter.add(
          positionOf(node),
          '',
          'stray-content',
          `text before ## ${ctx.words.categories}`,
        );
      } else last.body.push(node);
    }
  }
  const [first, ...termSections] = sections;
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
    if (first !== undefined) termSections.unshift(first);
  }
  if (termSections.length > MAX_TERMS) {
    ctx.reporter.add(
      START,
      'terms',
      'too-large',
      `the glossary has ${String(termSections.length)} terms; at most ${String(MAX_TERMS)}`,
    );
    return { language, title, categories, terms: [] };
  }

  const terms: GlossaryTerm[] = [];
  for (const { heading, body } of termSections) {
    const term = parseTerm(ctx, heading, body);
    if (term === null) continue;
    if (terms.some((t) => t.id === term.id)) {
      ctx.reporter.add(
        term.position,
        `terms.${term.id}`,
        'duplicate',
        `term \`${term.id}\` is listed twice`,
      );
      continue;
    }
    terms.push(term);
  }
  checkLinks(ctx, categories, terms);
  return { language, title, categories, terms };
}

/** Categories, «см. также» and forms point at things that exist and say one thing each. */
function checkLinks(
  ctx: Ctx,
  categories: readonly GlossaryCategory[],
  terms: readonly GlossaryTerm[],
): void {
  const ids = new Set(terms.map((t) => t.id));
  const owner = new Map<string, string>();
  for (const term of terms) {
    const path = `terms.${term.id}`;
    if (!categories.some((c) => c.id === term.category)) {
      ctx.reporter.add(
        term.position,
        path,
        'bad-value',
        `category \`${term.category}\` is not in ## ${ctx.words.categories}`,
      );
    }
    for (const id of term.see) {
      if (id === term.id)
        ctx.reporter.add(
          term.position,
          path,
          'bad-value',
          `term \`${id}\` names itself in \`see\``,
        );
      else if (!ids.has(id))
        ctx.reporter.add(
          term.position,
          path,
          'unknown-term',
          `\`see\` names \`${id}\`, which is not in the glossary`,
        );
    }
    if (new Set(term.see).size !== term.see.length) {
      ctx.reporter.add(term.position, path, 'duplicate', '`see` names a term twice');
    }
    if (new Set(term.lessons).size !== term.lessons.length) {
      ctx.reporter.add(term.position, path, 'duplicate', '`lessons` names a lesson twice');
    }
    for (const form of term.forms) {
      const key = normaliseForm(form);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, term.id);
      else if (other !== term.id) {
        ctx.reporter.add(
          term.position,
          path,
          'duplicate',
          `form "${quote(form, 40)}" belongs to \`${other}\` too; a form names one term`,
        );
      } else {
        ctx.reporter.add(
          term.position,
          path,
          'duplicate',
          `form "${quote(form, 40)}" is listed twice`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// One file

interface Checked {
  readonly path: string;
  readonly language: string | null;
  readonly glossary: Glossary | null;
  readonly errors: readonly LessonError[];
}

function checkOne(file: ContentFile, lessonIds: ReadonlySet<string>): Checked {
  const path = typeof file.path === 'string' ? file.path : '<not a file name>';
  const reporter = createReporter(path);
  const fail = (language: string | null): Checked => ({
    path,
    language,
    glossary: null,
    errors: capReported(reporter),
  });
  const match = GLOSSARY_PATH.exec(path);
  if (match === null) {
    reporter.add(
      START,
      '',
      'bad-path',
      'a glossary lives in content/locales/<language>/glossary.md',
    );
    return fail(null);
  }
  const language = match[1] ?? '';
  const words = glossaryWordsFor(language);
  if (words === null) {
    reporter.add(
      START,
      '',
      'unknown-language',
      `unknown language "${language}"; known: ${glossaryLanguages().join(', ')} (src/core/glossary/words.ts)`,
    );
    return fail(language);
  }
  if (typeof file.text !== 'string') {
    reporter.add(START, '', 'parse-failed', 'the file is not text');
    return fail(language);
  }
  const text = normaliseText(file.text);
  const limit = preflight(text, 'a glossary');
  if (limit !== null) {
    reporter.add({ line: limit.line, column: 1 }, '', limit.code, limit.message);
    return fail(language);
  }
  let root: Root;
  try {
    root = fromMarkdown(text);
  } catch {
    reporter.add(START, '', 'parse-failed', 'cannot read the file as Markdown');
    return fail(language);
  }
  const ctx: Ctx = { text, reporter, words };
  const glossary = parseGlossary(ctx, root, language);
  for (const term of glossary.terms) {
    for (const id of term.lessons) {
      if (!lessonIds.has(id)) {
        reporter.add(
          term.position,
          `terms.${term.id}`,
          'unknown-lesson',
          `\`lessons\` names ${id}, which is not in content/lessons`,
        );
      }
    }
  }
  // L4.2: documentation addresses only, in the whole file.
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
  const errors = capReported(reporter);
  return { path, language, glossary: errors.length === 0 ? glossary : null, errors };
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
// All glossaries, against the lessons

export interface GlossaryContext {
  /** Lessons that passed the lesson checker: their `term:` words are checked here. */
  readonly lessons: readonly Lesson[];
  /** Paths of all lesson files, checked or not: lesson ids and languages come from them. */
  readonly lessonPaths: readonly string[];
}

export interface GlossaryResult {
  /** Glossaries without errors. */
  readonly glossaries: readonly Glossary[];
  readonly errors: readonly LessonError[];
}

function compare(base: Glossary, other: Glossary, path: string): LessonError[] {
  const reporter = createReporter(path);
  const ru = glossaryPath(BASE_LANGUAGE);
  const cats = (g: Glossary) => g.categories.map((c) => c.id).join(', ');
  if (cats(base) !== cats(other)) {
    reporter.add(
      other.categories[0]?.position ?? START,
      'categories',
      'translation-mismatch',
      `categories are ${cats(other)} here but ${cats(base)} in ${ru}`,
    );
  }
  const shape = (t: GlossaryTerm) =>
    `${t.id} [${t.category}; see ${t.see.join(',')}; lessons ${t.lessons.join(',')}]`;
  const max = Math.max(base.terms.length, other.terms.length);
  for (let i = 0; i < max; i += 1) {
    const a = base.terms[i];
    const b = other.terms[i];
    if (a !== undefined && b !== undefined && shape(a) === shape(b)) continue;
    reporter.add(
      b?.position ?? START,
      `terms.${b?.id ?? a?.id ?? ''}`,
      'translation-mismatch',
      `term ${String(i + 1)} is ${b === undefined ? 'missing' : shape(b)} here but ${a === undefined ? 'absent' : shape(a)} in ${ru}: the same ids, categories, see and lessons in the same order`,
    );
  }
  return capReported(reporter);
}

/**
 * Checks every glossary file, the translations against the Russian one, that each lesson
 * language has a glossary (K94), and the `term:` words of the lessons. `files` are the files
 * named glossary.md under content/locales.
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
  const checked = files.map((f) => checkOne(f, lessonIds));
  const errors: LessonError[] = checked.flatMap((c) => c.errors);
  const byLanguage = new Map<string, Checked>();
  for (const c of checked) {
    if (c.language === null) continue;
    if (byLanguage.has(c.language)) {
      const reporter = createReporter(c.path);
      reporter.add(START, '', 'duplicate', `a second glossary in ${c.language}`);
      errors.push(...reporter.errors);
    } else byLanguage.set(c.language, c);
  }
  const languages = new Set([...lessonLanguages, ...byLanguage.keys()]);
  if (languages.size > 0) languages.add(BASE_LANGUAGE);
  for (const language of [...languages].sort()) {
    if (byLanguage.has(language)) continue;
    const reporter = createReporter(glossaryPath(language));
    reporter.add(
      START,
      '',
      'missing-glossary',
      `every site language has a glossary (K94): add ${glossaryPath(language)}`,
    );
    errors.push(...reporter.errors);
  }

  const base = byLanguage.get(BASE_LANGUAGE)?.glossary ?? null;
  const glossaries: Glossary[] = [];
  for (const c of checked) {
    if (c.glossary === null) continue;
    if (c.glossary.language !== BASE_LANGUAGE) {
      if (base === null) continue; // ru has its own errors; compare once it is fixed
      const mismatch = compare(base, c.glossary, c.path);
      errors.push(...mismatch);
      if (mismatch.length > 0) continue;
    }
    glossaries.push(c.glossary);
  }

  // `term:` on participants and zones names a term of the lesson's own glossary.
  for (const lesson of context.lessons) {
    const glossary = byLanguage.get(lesson.language)?.glossary;
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
          `\`term:${ref.term}\` is not in ${glossaryPath(lesson.language)}`,
        );
      }
    }
    errors.push(...capReported(reporter));
  }
  return { glossaries, errors };
}
