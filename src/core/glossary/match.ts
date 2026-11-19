/**
 * Finding glossary terms in lesson text (M2.4, K98). Runs at build time only: the site gets
 * `{ type: 'term', id, children }` nodes and never searches text (K31).
 *
 * The rule, the same for every language:
 * - a term is found by the word forms its glossary entry lists, never by a pattern;
 * - case does not matter, and «ё» is the same as «е»;
 * - a form matches whole words only: the characters around it are not letters, digits, `_` or
 *   `-` (so `SQL` is not found inside `SQL-инъекция`; list `SQL-инъекция` as its own form);
 * - spaces inside a form match one space or line break in the text;
 * - where forms of several terms start at the same place, the longest wins; the found text is
 *   skipped, so a shorter form is never found inside a longer match;
 * - one term is linked once per block (a paragraph, or a whole list), at its first occurrence;
 * - code is never searched: inline code and code blocks stay as they are;
 * - a term is found inside bold and italic text, but not across the edge of bold or italic; the
 *   characters just outside that edge still count for whole words, so in `**SQL**-инъекция`
 *   `SQL` is not a word of its own.
 */
import type { SiteBlock, SiteInline } from '../lesson/site';

export interface TermForms {
  readonly id: string;
  readonly forms: readonly string[];
}

interface Form {
  readonly text: string;
  readonly id: string;
}

export interface Matcher {
  /** Forms by their first character, longest first. */
  readonly byFirst: ReadonlyMap<string, readonly Form[]>;
}

/** Letters, combining marks, digits, `_` and `-` make up a word. */
const WORD = /[\p{L}\p{M}\p{N}_-]/u;

export function isWordChar(c: string | undefined): boolean {
  return c !== undefined && WORD.test(c);
}

/**
 * One UTF-16 unit at a time, so the result has the same length and indexes as the input: lower
 * case (a character whose lower case is longer stays as it is), «ё» → «е», any white space → ' '.
 */
export function normalise(text: string): string {
  let out = '';
  for (const c of text) {
    if (c.length !== 1) {
      out += c;
      continue;
    }
    if (/\s/.test(c)) {
      out += ' ';
      continue;
    }
    const lower = c.toLowerCase();
    const one = lower.length === 1 ? lower : c;
    out += one === 'ё' ? 'е' : one;
  }
  return out;
}

/** A form as the matcher compares it: normalised, spaces collapsed, trimmed. */
export function normaliseForm(form: string): string {
  return normalise(form).replace(/ +/g, ' ').trim();
}

export function createMatcher(terms: readonly TermForms[]): Matcher {
  const byFirst = new Map<string, Form[]>();
  for (const term of terms) {
    for (const raw of term.forms) {
      const text = normaliseForm(raw);
      const first = text[0];
      if (first === undefined) continue;
      const list = byFirst.get(first) ?? [];
      if (!list.some((f) => f.text === text)) list.push({ text, id: term.id });
      byFirst.set(first, list);
    }
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.text.length - a.text.length);
  return { byFirst };
}

/** Terms linked so far in the current block; `skip` is never linked (a definition's own term). */
interface Seen {
  readonly ids: Set<string>;
  readonly skip: string | null;
}

function findAt(matcher: Matcher, text: string, i: number, after: string): Form | null {
  const list = matcher.byFirst.get(text[i] ?? '');
  if (list === undefined) return null;
  for (const form of list) {
    const end = i + form.text.length;
    const next = end === text.length ? after || undefined : text[end];
    if (text.startsWith(form.text, i) && !isWordChar(next)) return form;
  }
  return null;
}

/** The first or last character of the text a node shows ('' for none). */
function edgeChar(node: SiteInline | undefined, end: 'first' | 'last'): string {
  if (node === undefined) return '';
  switch (node.type) {
    case 'text':
    case 'code':
      return end === 'first' ? node.value.slice(0, 1) : node.value.slice(-1);
    case 'break':
      return '\n';
    default: {
      const children = node.children;
      return edgeChar(end === 'first' ? children[0] : children[children.length - 1], end);
    }
  }
}

/** The characters just before and after a node, from its neighbours or its parent's. */
interface Edges {
  readonly before: string;
  readonly after: string;
}

function linkText(value: string, matcher: Matcher, seen: Seen, edges: Edges): SiteInline[] {
  const text = normalise(value);
  const out: SiteInline[] = [];
  let from = 0;
  let i = 0;
  while (i < text.length) {
    if (isWordChar(i === 0 ? edges.before || undefined : text[i - 1])) {
      i += 1;
      continue;
    }
    const form = findAt(matcher, text, i, edges.after);
    if (form === null) {
      i += 1;
      continue;
    }
    const end = i + form.text.length;
    if (!seen.ids.has(form.id) && form.id !== seen.skip) {
      seen.ids.add(form.id);
      if (i > from) out.push({ type: 'text', value: value.slice(from, i) });
      out.push({
        type: 'term',
        id: form.id,
        children: [{ type: 'text', value: value.slice(i, end) }],
      });
      from = end;
    }
    i = end;
  }
  if (from === 0) return [{ type: 'text', value }];
  if (from < value.length) out.push({ type: 'text', value: value.slice(from) });
  return out;
}

function linkInline(
  nodes: readonly SiteInline[],
  matcher: Matcher,
  seen: Seen,
  edges: Edges,
): SiteInline[] {
  const out: SiteInline[] = [];
  nodes.forEach((node, k) => {
    const around: Edges = {
      before: k === 0 ? edges.before : edgeChar(nodes[k - 1], 'last'),
      after: k === nodes.length - 1 ? edges.after : edgeChar(nodes[k + 1], 'first'),
    };
    switch (node.type) {
      case 'text':
        out.push(...linkText(node.value, matcher, seen, around));
        break;
      case 'strong':
      case 'emphasis':
        out.push({ type: node.type, children: linkInline(node.children, matcher, seen, around) });
        break;
      default:
        // Inline code, line breaks and terms already linked stay as they are.
        out.push(node);
    }
  });
  return out;
}

function linkBlock(block: SiteBlock, matcher: Matcher, seen: Seen): SiteBlock {
  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        children: linkInline(block.children, matcher, seen, { before: '', after: '' }),
      };
    case 'list':
      return {
        type: 'list',
        ordered: block.ordered,
        items: block.items.map((item) => item.map((b) => linkBlock(b, matcher, seen))),
      };
    case 'code':
      return block;
  }
}

/**
 * The same text with glossary terms as `term` nodes. `skip` is a term id never linked: a
 * definition does not link to itself.
 */
export function linkTerms(
  blocks: readonly SiteBlock[],
  matcher: Matcher,
  skip: string | null = null,
): SiteBlock[] {
  // A new `seen` per top-level block: a term is linked once per paragraph or list.
  return blocks.map((block) => linkBlock(block, matcher, { ids: new Set(), skip }));
}
