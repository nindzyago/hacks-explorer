import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../catalog/catalog';
import { createGlossaryLoader } from './glossary';

const INDEX = {
  format: 2,
  language: 'ru',
  title: 'Словарь',
  categories: [{ id: 'web', label: 'Веб' }],
  terms: [
    { id: 'sql', title: 'SQL', category: 'web', chunk: 0 },
    { id: 'query', title: 'Запрос', category: 'web', chunk: 1 },
  ],
  chunks: ['0000000a', '0000000b'],
};
const CHUNKS: Record<string, unknown> = {
  '/b/data/glossary/ru.0000000a.json': {
    format: 2,
    language: 'ru',
    terms: [{ id: 'sql', definition: [], see: ['query'], lessons: [] }],
  },
  '/b/data/glossary/ru.0000000b.json': {
    format: 2,
    language: 'ru',
    terms: [{ id: 'query', definition: [], see: [], lessons: [{ id: 'B1', title: 'SQL' }] }],
  },
};

function server(body: (url: string) => string, status = 200): { fetch: FetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetch: FetchLike = (url) => {
    urls.push(url);
    return Promise.resolve({
      ok: status < 400,
      status,
      headers: { get: () => null },
      text: () => Promise.resolve(body(url)),
    });
  };
  return { fetch, urls };
}

const site = (url: string) =>
  JSON.stringify(url === '/b/data/glossary/ru.json' ? INDEX : (CHUNKS[url] ?? null));

describe('createGlossaryLoader', () => {
  it('loads the index of the language once and keeps it', async () => {
    const s = server(site);
    const loader = createGlossaryLoader({ fetch: s.fetch, base: '/b/' });
    const first = await loader.glossary('ru');
    expect(first.ok && first.value.terms[0]?.id).toBe('sql');
    await loader.glossary('ru');
    expect(s.urls).toEqual(['/b/data/glossary/ru.json']);
  });

  it('loads a term with its chunk only, each file once, and knows it afterwards', async () => {
    const s = server(site);
    const loader = createGlossaryLoader({ fetch: s.fetch, base: '/b/' });
    expect(loader.known('ru', 'sql')).toBeUndefined();
    const [a, b] = await Promise.all([loader.term('ru', 'sql'), loader.term('ru', 'sql')]);
    expect(a.ok && a.value.term).toEqual({
      id: 'sql',
      title: 'SQL',
      category: 'web',
      definition: [],
      see: ['query'],
      lessons: [],
    });
    expect(b).toEqual(a);
    expect(s.urls).toEqual(['/b/data/glossary/ru.json', '/b/data/glossary/ru.0000000a.json']);
    expect(loader.known('ru', 'sql')?.term?.title).toBe('SQL');
    // The other chunk is not here yet.
    expect(loader.known('ru', 'query')).toBeUndefined();
    const q = await loader.term('ru', 'query');
    expect(q.ok && q.value.term?.lessons).toEqual([{ id: 'B1', title: 'SQL' }]);
    expect(s.urls).toHaveLength(3);
  });

  it('answers a term the index does not have with null, without a chunk', async () => {
    const s = server(site);
    const loader = createGlossaryLoader({ fetch: s.fetch, base: '/b/' });
    const r = await loader.term('ru', 'nothing');
    expect(r.ok && r.value.term).toBeNull();
    expect(loader.known('ru', 'nothing')?.term).toBeNull();
    expect(s.urls).toEqual(['/b/data/glossary/ru.json']);
  });

  it('gives typed errors and tries again after a failure', async () => {
    let body = 'not json';
    const s = server(() => body);
    const loader = createGlossaryLoader({ fetch: s.fetch });
    const bad = await loader.glossary('ru');
    expect(!bad.ok && bad.error.code).toBe('bad-data');
    body = JSON.stringify(INDEX);
    expect((await loader.glossary('ru')).ok).toBe(true);
    expect(s.urls).toHaveLength(2);
  });

  it('refuses a chunk that is broken, swapped or stale, and tries it again later', async () => {
    let chunk: unknown = CHUNKS['/b/data/glossary/ru.0000000b.json'];
    const s = server((url) =>
      url.endsWith('ru.json') ? JSON.stringify(INDEX) : JSON.stringify(chunk),
    );
    const loader = createGlossaryLoader({ fetch: s.fetch, base: '/b/' });
    const swapped = await loader.term('ru', 'sql');
    expect(!swapped.ok && swapped.error.code).toBe('bad-data');
    for (const bad of [null, 'x', { format: 1 }, { format: 2, language: 'en', terms: [] }]) {
      chunk = bad;
      const r = await loader.term('ru', 'sql');
      expect(!r.ok && r.error.code).toBe('bad-data');
    }
    chunk = {
      format: 2,
      language: 'ru',
      terms: [{ id: 'sql', definition: [], see: ['nothing'], lessons: [] }],
    };
    expect((await loader.term('ru', 'sql')).ok).toBe(false);
    chunk = CHUNKS['/b/data/glossary/ru.0000000a.json'];
    expect((await loader.term('ru', 'sql')).ok).toBe(true);
  });

  it('refuses a language or term that is not one, a swapped file, a missing file and a throwing fetch', async () => {
    const s = server(() => JSON.stringify(INDEX));
    const loader = createGlossaryLoader({ fetch: s.fetch });
    for (const language of ['../x', '', 42, null, 'RU']) {
      const r = await loader.glossary(language);
      expect(!r.ok && r.error.code).toBe('not-found');
      const t = await loader.term(language, 'sql');
      expect(!t.ok && t.error.code).toBe('not-found');
    }
    for (const id of ['../x', '', 42, null, 'SQL', 'a'.repeat(40)]) {
      const t = await loader.term('ru', id);
      expect(!t.ok && t.error.code).toBe('not-found');
      expect(loader.known('ru', id)).toBeUndefined();
    }
    expect(s.urls).toEqual([]);
    const swapped = await loader.glossary('en');
    expect(!swapped.ok && swapped.error.code).toBe('bad-data');
    const missing = await createGlossaryLoader({ fetch: server(() => '', 404).fetch }).term(
      'ru',
      'sql',
    );
    expect(!missing.ok && missing.error.code).toBe('not-found');
    const throwing = createGlossaryLoader({
      fetch: () => {
        throw new Error('boom');
      },
    });
    const thrown = await throwing.glossary('ru');
    expect(!thrown.ok && thrown.error.code).toBe('network');
  });
});
