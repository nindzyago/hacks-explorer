// M2.4: the site reads the glossary file as hostile input (L0.2) and the build writes it with
// definitions linked to other terms, never to themselves.
import { describe, expect, it } from 'vitest';
import { toSiteGlossary } from './build';
import { readSiteGlossary } from './site';
import type { Glossary } from './types';

const P = { line: 1, column: 1 };
const GLOSSARY: Glossary = {
  language: 'ru',
  title: 'Словарь',
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
      position: P,
    },
  ],
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
    const text = JSON.stringify(site);
    expect(text).not.toContain('"forms"');
    expect(text).not.toContain('"position"');
  });

  it('reads back', () => {
    const read = readSiteGlossary(JSON.parse(JSON.stringify(site)), 'ru');
    expect(read).toEqual({ ok: true, value: site });
  });
});

describe('readSiteGlossary on hostile data', () => {
  const good = JSON.parse(JSON.stringify(toSiteGlossary(GLOSSARY, new Map()))) as Record<
    string,
    unknown
  >;
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

  it('accepts the good file, rejects another language', () => {
    expect(readSiteGlossary(good, 'ru').ok).toBe(true);
    expect(readSiteGlossary(good, 'en').ok).toBe(false);
  });

  it('rejects broken files without throwing', () => {
    for (const input of [null, 42, 'x', [], {}, { format: 2 }]) {
      expect(readSiteGlossary(input, 'ru').ok).toBe(false);
    }
    expect(
      bad((g) => {
        firstTerm(g)['see'] = ['nothing'];
      }),
    ).toBe(false);
    expect(
      bad((g) => {
        firstTerm(g)['category'] = 'other';
      }),
    ).toBe(false);
    expect(
      bad((g) => {
        firstTerm(g)['id'] = '<b>';
      }),
    ).toBe(false);
    expect(
      bad((g) => {
        g['terms'] = [...(g['terms'] as unknown[]), (g['terms'] as unknown[])[0]];
      }),
    ).toBe(false);
    expect(
      bad((g) => {
        g['terms'] = Array.from({ length: 301 }, (_, i) => ({
          id: `t${String(i)}`,
          title: 'x',
          category: 'web',
          definition: [],
          see: [],
          lessons: [],
        }));
      }),
    ).toBe(false);
  });

  it('drops extra fields and __proto__ keys', () => {
    const text = JSON.stringify(good).replace(
      '"format":1',
      '"format":1,"__proto__":{"x":1},"extra":2',
    );
    const read = readSiteGlossary(JSON.parse(text), 'ru');
    expect(read.ok && Object.keys(read.value)).toEqual([
      'format',
      'language',
      'title',
      'categories',
      'terms',
    ]);
  });
});
