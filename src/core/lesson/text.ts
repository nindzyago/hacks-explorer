/**
 * Markdown text → the lesson text tree (design E4): paragraphs, lists, bold, italic, inline code
 * and code blocks. HTML, images and links are errors; links belong only in «Источники».
 */
import type { Nodes, PhrasingContent, RootContent } from 'mdast';
import type { Reporter } from './report';
import { START } from './report';
import type { Block, CodeBlock, CodeSegment, Inline, Position } from './types';

/** Deeper nesting than this is an error, so a hostile file cannot exhaust the stack. */
export const MAX_DEPTH = 16;

export function positionOf(node: Nodes): Position {
  const start = node.position?.start;
  return start === undefined ? START : { line: start.line, column: start.column };
}

function forbidden(node: Nodes, reporter: Reporter, path: string): void {
  const at = positionOf(node);
  switch (node.type) {
    case 'html':
      reporter.add(at, path, 'html', 'HTML is not allowed in lesson text; use Markdown');
      return;
    case 'image':
    case 'imageReference':
      reporter.add(at, path, 'image', 'images are not allowed in lesson text');
      return;
    case 'link':
    case 'linkReference':
    case 'definition':
      reporter.add(at, path, 'link', 'links are allowed only in the sources section');
      return;
    default:
      reporter.add(
        at,
        path,
        'not-allowed',
        `${node.type} is not allowed in lesson text; use paragraphs, lists, **bold**, *italic*, \`code\` and code blocks`,
      );
  }
}

function inline(
  nodes: readonly PhrasingContent[],
  reporter: Reporter,
  path: string,
  depth: number,
): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (depth > MAX_DEPTH) {
      reporter.add(positionOf(node), path, 'too-deep', `nesting deeper than ${String(MAX_DEPTH)}`);
      return out;
    }
    switch (node.type) {
      case 'text':
        out.push({ type: 'text', value: node.value });
        break;
      case 'inlineCode':
        out.push({ type: 'code', value: node.value });
        break;
      case 'break':
        out.push({ type: 'break' });
        break;
      case 'strong':
      case 'emphasis':
        out.push({ type: node.type, children: inline(node.children, reporter, path, depth + 1) });
        break;
      default:
        forbidden(node, reporter, path);
    }
  }
  return out;
}

/** Splits code into pieces; ⟦…⟧ marks the harmful part. Marks must pair up and not nest. */
export function codeSegments(value: string): CodeSegment[] | null {
  const segments: CodeSegment[] = [];
  let rest = value;
  for (;;) {
    const open = rest.indexOf('⟦');
    const close = rest.indexOf('⟧');
    if (open < 0) {
      if (close >= 0) return null;
      if (rest !== '') segments.push({ text: rest, marked: false });
      return segments;
    }
    if (close < open) return null;
    const inside = rest.slice(open + 1, close);
    if (inside === '' || inside.includes('⟦')) return null;
    if (open > 0) segments.push({ text: rest.slice(0, open), marked: false });
    segments.push({ text: inside, marked: true });
    rest = rest.slice(close + 1);
  }
}

export function codeBlock(
  node: { value: string; lang?: string | null | undefined } & Nodes,
  reporter: Reporter,
  path: string,
): CodeBlock {
  const at = positionOf(node);
  const segments = codeSegments(node.value);
  if (segments === null) {
    reporter.add(at, path, 'bad-mark', 'marks ⟦…⟧ in code must pair up, not nest and not be empty');
  }
  return { type: 'code', lang: node.lang ?? '', segments: segments ?? [], position: at };
}

/** Converts the blocks of one text (a level, «Как защититься»). */
export function blocks(
  nodes: readonly RootContent[],
  reporter: Reporter,
  path: string,
  depth = 0,
): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    if (depth > MAX_DEPTH) {
      reporter.add(positionOf(node), path, 'too-deep', `nesting deeper than ${String(MAX_DEPTH)}`);
      return out;
    }
    switch (node.type) {
      case 'paragraph':
        out.push({
          type: 'paragraph',
          children: inline(node.children, reporter, path, depth + 1),
          position: positionOf(node),
        });
        break;
      case 'list':
        out.push({
          type: 'list',
          ordered: node.ordered === true,
          items: node.children.map((item) => blocks(item.children, reporter, path, depth + 1)),
          position: positionOf(node),
        });
        break;
      case 'code':
        out.push(codeBlock(node, reporter, path));
        break;
      default:
        forbidden(node, reporter, path);
    }
  }
  return out;
}
