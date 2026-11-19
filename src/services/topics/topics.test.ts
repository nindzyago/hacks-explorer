// M2.1b: the topics of the lessons panel load once per language; bad files are typed errors.
import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../catalog/catalog';
import { createTopicsLoader } from './topics';

const FILE = {
  format: 1,
  language: 'ru',
  sections: [
    {
      id: 'B',
      title: 'Веб: инъекции',
      topics: [{ id: 'B1', title: 'SQL-инъекция', note: null, ready: true }],
    },
  ],
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

describe('createTopicsLoader', () => {
  it('loads the file of the language once and keeps it', async () => {
    const s = server(() => JSON.stringify(FILE));
    const loader = createTopicsLoader({ fetch: s.fetch, base: '/b/' });
    const first = await loader.topics('ru');
    expect(first.ok && first.value.sections[0]?.topics[0]?.id).toBe('B1');
    await loader.topics('ru');
    expect(s.urls).toEqual(['/b/data/topics/ru.json']);
  });

  it('gives typed errors and tries again after a failure', async () => {
    let body = '{"format":1';
    const s = server(() => body);
    const loader = createTopicsLoader({ fetch: s.fetch });
    const bad = await loader.topics('ru');
    expect(!bad.ok && bad.error.code).toBe('bad-data');
    body = JSON.stringify(FILE);
    expect((await loader.topics('ru')).ok).toBe(true);
    expect(s.urls).toHaveLength(2);
  });

  it('refuses a language that is not one, a swapped file, a missing file and a throwing fetch', async () => {
    const s = server(() => JSON.stringify(FILE));
    const loader = createTopicsLoader({ fetch: s.fetch });
    for (const language of ['../x', '', 42, null, 'RU', undefined]) {
      const r = await loader.topics(language);
      expect(!r.ok && r.error.code).toBe('not-found');
    }
    expect(s.urls).toEqual([]);
    const swapped = await loader.topics('en');
    expect(!swapped.ok && swapped.error.code).toBe('bad-data');
    const missing = await createTopicsLoader({ fetch: server(() => '', 404).fetch }).topics('ru');
    expect(!missing.ok && missing.error.code).toBe('not-found');
    const down = await createTopicsLoader({ fetch: server(() => '', 503).fetch }).topics('ru');
    expect(!down.ok && down.error.code).toBe('network');
    const throwing = createTopicsLoader({
      fetch: () => {
        throw new Error('no network');
      },
    });
    const thrown = await throwing.topics('ru');
    expect(!thrown.ok && thrown.error.code).toBe('network');
  });
});
