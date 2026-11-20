// M2.4, CI3: the site reads the glossary index and chunks as hostile input (L0.2); the build writes
// definitions linked to other terms, never to themselves, split into chunks of a bounded size.
import { describe, expect, it } from 'vitest';
import { splitSiteGlossary, toSiteGlossary } from './build';
import { MAX_GLOSSARY_TERMS, glossaryTerm, readGlossaryChunk, readSiteGlossary } from './site';
import type { Glossary } from './types';

const P = { line: 1, column: 1 };
const FILE = 'content/locales/ru/glossary/web.md';
const GLOSSARY: Glossary = {
  language: 'ru',
  title: 'Словарь',
  index: 'content/locales/ru/glossary/index.md',
  categories: [{ id: 'web', label: 'Веб', position: P }],
  terms: [
    {
      id: 'sql',
      title: 'SQL',
      category: 'web',
      forms: ['SQL'],
      see: ['query'],
      lessons: ['B1', 'Z9'],
      definition: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'SQL — язык, запрос к базе.' }],
          position: P,
        },
      ],
      file: FILE,
      position: P,
    },
    {
      id: 'query',
      title: 'Запрос',
      category: 'web',
      forms: ['запрос'],
      see: [],
      lessons: [],
      definition: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Запрос на SQL.' }], position: P },
      ],
      file: FILE,
      position: P,
    },
  ],
};

const fakeHash = (text: string): string => {
  let h = 0;
  for (const c of text) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return h.toString(16).padStart(8, '0').slice(-8);
};

describe('toSiteGlossary', () => {
  const site = toSiteGlossary(GLOSSARY, new Map([['B1', 'SQL-инъекция']]));

  it('links other terms in a definition, never the term itself', () => {
    expect(site.terms[0]?.definition).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'SQL — язык, ' },
          { type: 'term', id: 'query', children: [{ type: 'text', value: 'запрос' }] },
          { type: 'text', value: ' к базе.' },
        ],
      },
    ]);
  });

  it('gives related lessons with their titles and drops lessons without one', () => {
    expect(site.terms[0]?.lessons).toEqual([{ id: 'B1', title: 'SQL-инъекция' }]);
  });

  it('carries no forms and no positions', () => {
    const text = JSON.stringify(splitSiteGlossary(site, fakeHash));
    expect(text).not.toContain('"forms"');
    expect(text).not.toContain('"position"');
  });

  it('reads back from the index and the chunks, term for term', () => {
    const split = splitSiteGlossary(site, fakeHash);
    const index = readSiteGlossary(JSON.parse(JSON.stringify(split.index)), 'ru');
    expect(index).toEqual({ ok: true, value: split.index });
    if (!index.ok) return;
    const back = split.chunks.flatMap((c, n) => {
      const chunk = readGlossaryChunk(JSON.parse(c.text), index.value, n);
      if (!chunk.ok) throw new Error(chunk.error.message);
      return chunk.value.terms.map((t) => glossaryTerm(index.value, chunk.value, t.id));
    });
    expect(back).toEqual(site.terms);
  });
});

describe('splitSiteGlossary', () => {
  const site = toSiteGlossary(GLOSSARY, new Map());
  const many = {
    ...site,
    terms: Array.from({ length: 40 }, (_, i) => ({
      ...(site.terms[0] ?? {
        id: '',
        title: '',
        category: '',
        definition: [],
        see: [],
        lessons: [],
      }),
      id: `t${String(i)}`,
      see: [],
    })),
  };

  it('keeps one chunk while it fits, and runs of terms in order when it does not', () => {
    expect(splitSiteGlossary(site, fakeHash).chunks).toHaveLength(1);
    const split = splitSiteGlossary(many, fakeHash, 1024);
    expect(split.chunks.length).toBeGreaterThan(3);
    for (const c of split.chunks)
      expect(new TextEncoder().encode(c.text).length).toBeLessThanOrEqual(1024);
    const order = split.index.terms.map((t) => t.chunk);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(split.index.chunks).toEqual(split.chunks.map((c) => c.hash));
  });

  it('gives a term larger than a chunk a chunk of its own', () => {
    const split = splitSiteGlossary(many, fakeHash, 10);
    expect(split.chunks).toHaveLength(40);
  });

  it('puts no definitions in the index', () => {
    expect(JSON.stringify(splitSiteGlossary(site, fakeHash).index)).not.toContain('definition');
  });
});

describe('readSiteGlossary and readGlossaryChunk on hostile data', () => {
  const split = splitSiteGlossary(toSiteGlossary(GLOSSARY, new Map()), fakeHash);
  const good = JSON.parse(JSON.stringify(split.index)) as Record<string, unknown>;
  const firstTerm = (g: Record<string, unknown>): Record<string, unknown> => {
    const terms = g['terms'];
    const first: unknown = Array.isArray(terms) ? terms[0] : undefined;
    if (typeof first !== 'object' || first === null) throw new Error('no term');
    return first as Record<string, unknown>;
  };
  const bad = (change: (g: Record<string, unknown>) => void) => {
    const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
    change(copy);
    return readSiteGlossary(copy, 'ru').ok;
  };

  it('accepts the good index, rejects another language', () => {
    expect(readSiteGlossary(good, 'ru').ok).toBe(true);
    expect(readSiteGlossary(good, 'en').ok).toBe(false);
  });

  it('rejects broken indexes without throwing', () => {
    for (const input of [null, 42, 'x', [], {}, { format: 1 }, { format: 2 }]) {
      expect(readSiteGlossary(input, 'ru').ok).toBe(false);
    }
    const changes: ((g: Record<string, unknown>) => void)[] = [
      (g) => {
        firstTerm(g)['category'] = 'other';
      },
      (g) => {
        firstTerm(g)['id'] = '<b>';
      },
      (g) => {
        firstTerm(g)['chunk'] = 5;
      },
      (g) => {
        firstTerm(g)['chunk'] = -1;
      },
      (g) => {
        firstTerm(g)['chunk'] = 0.5;
      },
      (g) => {
        firstTerm(g)['chunk'] = '0';
      },
      (g) => {
        g['chunks'] = ['../x.json'];
      },
      (g) => {
        g['chunks'] = [...(g['chunks'] as unknown[]), (g['chunks'] as unknown[])[0]];
      },
      (g) => {
        g['terms'] = [...(g['terms'] as unknown[]), (g['terms'] as unknown[])[0]];
      },
      (g) => {
        g['terms'] = Array.from({ length: MAX_GLOSSARY_TERMS + 1 }, (_, i) => ({
          id: `t${String(i)}`,
          title: 'x',
          category: 'web',
          chunk: 0,
        }));
      },
    ];
    for (const change of changes) expect(bad(change)).toBe(false);
  });

  it('rejects a chunk that is broken, of another chunk, cut or links unknown terms', () => {
    const index = readSiteGlossary(good, 'ru');
    if (!index.ok) throw new Error(index.error.message);
    const text = split.chunks[0]?.text ?? '';
    const chunk = JSON.parse(text) as Record<string, unknown>;
    expect(readGlossaryChunk(chunk, index.value, 0).ok).toBe(true);
    expect(readGlossaryChunk(chunk, index.value, 1).ok).toBe(false);
    for (const input of [null, 42, 'x', [], {}, { format: 1 }]) {
      expect(readGlossaryChunk(input, index.value, 0).ok).toBe(false);
    }
    const terms = chunk['terms'] as Record<string, unknown>[];
    const variants: unknown[] = [
      { ...chunk, language: 'en' },
      { ...chunk, terms: terms.slice(1) },
      { ...chunk, terms: [...terms].reverse() },
      { ...chunk, terms: terms.map((t, i) => (i === 0 ? { ...t, see: ['nothing'] } : t)) },
      { ...chunk, terms: terms.map((t, i) => (i === 0 ? { ...t, definition: '<b>' } : t)) },
    ];
    for (const v of variants) expect(readGlossaryChunk(v, index.value, 0).ok).toBe(false);
  });

  it('drops extra fields and __proto__ keys', () => {
    const text = JSON.stringify(good).replace(
      '"format":2',
      '"format":2,"__proto__":{"x":1},"extra":2',
    );
    const read = readSiteGlossary(JSON.parse(text), 'ru');
    expect(read.ok && Object.keys(read.value)).toEqual([
      'format',
      'language',
      'title',
      'categories',
      'terms',
      'chunks',
    ]);
  });
});
