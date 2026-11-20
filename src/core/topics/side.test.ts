// UI2: the lessons column groups the topics by section — ready lessons first within a section,
// the topics still being written after them — and a section chip keeps one section.
import { describe, expect, it } from 'vitest';
import { sideGroups } from './search';
import type { SiteTopicSection } from './site';

const SECTIONS: readonly SiteTopicSection[] = [
  {
    id: 'B',
    title: 'Injection',
    short: 'Inj',
    topics: [
      { id: 'B1', title: 'SQL injection', note: null, ready: true },
      { id: 'B2', title: 'Command injection', note: null, ready: false },
    ],
  },
  {
    id: 'C',
    title: 'Browser',
    short: 'Browser',
    topics: [
      { id: 'C1', title: 'Reflected XSS', note: null, ready: true },
      { id: 'C2', title: 'Stored XSS', note: null, ready: false },
      { id: 'C3', title: 'DOM XSS', note: null, ready: false },
      { id: 'C4', title: 'CSRF', note: null, ready: true },
    ],
  },
  {
    id: 'G',
    title: 'Network',
    short: 'Network',
    topics: [{ id: 'G1', title: 'Man in the middle', note: null, ready: false }],
  },
];

const ids = (topics: readonly { readonly id: string }[]) => topics.map((t) => t.id);
const shape = (groups: ReturnType<typeof sideGroups>) =>
  groups.map((g) => [g.section.id, ids(g.ready), ids(g.soon), g.readyCount, g.count]);

describe('sideGroups', () => {
  it('shows every section, ready lessons first, then the topics still being written', () => {
    expect(shape(sideGroups(SECTIONS, { query: '', section: null }))).toEqual([
      ['B', ['B1'], ['B2'], 1, 2],
      ['C', ['C1', 'C4'], ['C2', 'C3'], 2, 4],
      ['G', [], ['G1'], 0, 1],
    ]);
  });

  it('keeps one section with its chip', () => {
    expect(shape(sideGroups(SECTIONS, { query: '', section: 'C' }))).toEqual([
      ['C', ['C1', 'C4'], ['C2', 'C3'], 2, 4],
    ]);
  });

  it('a search keeps the matching topics, sections without a match are left out', () => {
    // The counts of a section stay those of the whole section.
    expect(shape(sideGroups(SECTIONS, { query: 'xss', section: null }))).toEqual([
      ['C', ['C1'], ['C2', 'C3'], 2, 4],
    ]);
    expect(shape(sideGroups(SECTIONS, { query: 'xss', section: 'B' }))).toEqual([]);
  });

  it('gives nothing for an unknown section or a query that matches nothing', () => {
    expect(sideGroups(SECTIONS, { query: '', section: 'Z' })).toEqual([]);
    expect(sideGroups(SECTIONS, { query: 'zzz', section: null })).toEqual([]);
  });

  it('treats a query of only punctuation as no query', () => {
    expect(sideGroups(SECTIONS, { query: ' -- ', section: null })).toHaveLength(3);
  });
});
