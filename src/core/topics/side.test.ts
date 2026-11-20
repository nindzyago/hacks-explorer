// M6.1: the lessons list of the left panel — ready lessons first, the topics still being written
// at the end with «Все» or when searching; the section chips of the top bar filter it.
import { describe, expect, it } from 'vitest';
import { sideList } from './search';
import type { SiteTopicSection } from './site';

const SECTIONS: readonly SiteTopicSection[] = [
  {
    id: 'B',
    title: 'Injection',
    topics: [
      { id: 'B1', title: 'SQL injection', note: null, ready: true },
      { id: 'B2', title: 'Command injection', note: null, ready: false },
    ],
  },
  {
    id: 'C',
    title: 'Browser',
    topics: [
      { id: 'C1', title: 'Reflected XSS', note: null, ready: true },
      { id: 'C2', title: 'Stored XSS', note: null, ready: false },
      { id: 'C4', title: 'CSRF', note: null, ready: true },
    ],
  },
];

const ids = (topics: readonly { readonly id: string }[]) => topics.map((t) => t.id);

describe('sideList', () => {
  it('shows only the ready lessons by default, with both counts', () => {
    const list = sideList(SECTIONS, { query: '', section: null, all: false });
    expect(ids(list.ready)).toEqual(['B1', 'C1', 'C4']);
    expect(list.soon).toEqual([]);
    expect([list.readyCount, list.allCount]).toEqual([3, 5]);
  });

  it('puts the topics still being written after the ready ones with «Все»', () => {
    const list = sideList(SECTIONS, { query: '', section: null, all: true });
    expect(ids(list.ready)).toEqual(['B1', 'C1', 'C4']);
    expect(ids(list.soon)).toEqual(['B2', 'C2']);
  });

  it('finds a topic still being written by search even without «Все»', () => {
    const list = sideList(SECTIONS, { query: 'xss', section: null, all: false });
    expect(ids(list.ready)).toEqual(['C1']);
    expect(ids(list.soon)).toEqual(['C2']);
  });

  it('keeps one section, counts included', () => {
    const list = sideList(SECTIONS, { query: '', section: 'C', all: false });
    expect(ids(list.ready)).toEqual(['C1', 'C4']);
    expect([list.readyCount, list.allCount]).toEqual([2, 3]);
  });

  it('gives an empty list for an unknown section or a query that matches nothing', () => {
    expect(sideList(SECTIONS, { query: '', section: 'Z', all: true })).toEqual({
      ready: [],
      soon: [],
      readyCount: 0,
      allCount: 0,
    });
    const none = sideList(SECTIONS, { query: 'zzz', section: null, all: true });
    expect([none.ready, none.soon]).toEqual([[], []]);
  });

  it('treats a query of only punctuation as no query', () => {
    const list = sideList(SECTIONS, { query: ' -- ', section: null, all: false });
    expect(ids(list.ready)).toEqual(['B1', 'C1', 'C4']);
    expect(list.soon).toEqual([]);
  });
});
