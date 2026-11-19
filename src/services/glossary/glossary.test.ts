import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../catalog/catalog';
import { createGlossaryLoader } from './glossary';

const FILE = {
  format: 1,
  language: 'ru',
  title: 'Словарь',
  categories: [{ id: 'web', label: 'Веб' }],
  terms: [{ id: 'sql', title: 'SQL', category: 'web', definition: [], see: [], lessons: [] }],
};

function server(body: () => string, status = 200): { fetch: FetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetch: FetchLike = (url) => {
    urls.push(url);
    return Promise.resolve({
      ok: status < 400,
      status,
      headers: { get: () => null },
      text: () => Promise.resolve(body()),
    });
  };
  return { fetch, urls };
}

describe('createGlossaryLoader', () => {
  it('loads the file of the language once and keeps it', async () => {
    const s = server(() => JSON.stringify(FILE));
    const loader = createGlossaryLoader({ fetch: s.fetch, base: '/b/' });
    const first = await loader.glossary('ru');
    expect(first.ok && first.value.terms[0]?.id).toBe('sql');
    await loader.glossary('ru');
    expect(s.urls).toEqual(['/b/data/glossary/ru.json']);
  });

  it('gives typed errors and tries again after a failure', async () => {
    let body = 'not json';
    const s = server(() => body);
    const loader = createGlossaryLoader({ fetch: s.fetch });
    const bad = await loader.glossary('ru');
    expect(!bad.ok && bad.error.code).toBe('bad-data');
    body = JSON.stringify(FILE);
    expect((await loader.glossary('ru')).ok).toBe(true);
    expect(s.urls).toHaveLength(2);
  });

  it('refuses a language that is not a language, a swapped file, a missing file and a throwing fetch', async () => {
    const s = server(() => JSON.stringify(FILE));
    const loader = createGlossaryLoader({ fetch: s.fetch });
    for (const language of ['../x', '', 42, null, 'RU']) {
      const r = await loader.glossary(language);
      expect(!r.ok && r.error.code).toBe('not-found');
    }
    expect(s.urls).toEqual([]);
    const swapped = await loader.glossary('en');
    expect(!swapped.ok && swapped.error.code).toBe('bad-data');
    const missing = await createGlossaryLoader({ fetch: server(() => '', 404).fetch }).glossary(
      'ru',
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
