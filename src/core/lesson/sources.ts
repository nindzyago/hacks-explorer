/**
 * `content/sources.md`: the domains that source links may point at (design E8). Every list item
 * is `` - `domain` Who is behind it ``; everything else in the file is free text for people.
 */
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Reporter } from './report';
import { START, quote } from './report';
import { positionOf } from './text';

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function parseSourceDomains(text: string, reporter: Reporter): string[] {
  const domains: string[] = [];
  let root;
  try {
    root = fromMarkdown(text);
  } catch {
    reporter.add(START, 'sources', 'parse-failed', 'cannot read the file as Markdown');
    return domains;
  }
  for (const node of root.children) {
    if (node.type !== 'list') continue;
    for (const item of node.children) {
      const p = item.children[0];
      const start = p?.position?.start.offset;
      const end = p?.position?.end.offset;
      const line =
        p?.type === 'paragraph' &&
        item.children.length === 1 &&
        start !== undefined &&
        end !== undefined
          ? text.slice(start, end).trim()
          : '';
      const match = /^`([^`]+)`\s+\S/.exec(line);
      const domain = match?.[1] ?? '';
      if (match === null || !DOMAIN.test(domain)) {
        reporter.add(
          positionOf(item),
          'sources',
          'bad-line',
          `a line looks like - \`owasp.org\` OWASP, not "${quote(line)}"`,
        );
      } else if (domains.includes(domain)) {
        reporter.add(positionOf(item), 'sources', 'duplicate', `${domain} is listed twice`);
      } else domains.push(domain);
    }
  }
  if (domains.length === 0) {
    reporter.add(START, 'sources', 'empty-section', 'no source domains are listed');
  }
  return domains;
}
