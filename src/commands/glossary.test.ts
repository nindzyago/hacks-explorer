// M2.4: `glossary.open` and `glossary.close` — one definition open at a time.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('glossary.open / glossary.close', () => {
  it('starts closed, opens a term, replaces it with another and closes', () => {
    const a = createApp();
    expect(a.store.get().glossary).toBeNull();
    expect(a.registry.run('glossary.open', { id: 'sql' })).toEqual({ ok: true });
    expect(a.store.get().glossary).toBe('sql');
    a.registry.run('glossary.open', { id: 'query' });
    expect(a.store.get().glossary).toBe('query');
    expect(a.registry.run('glossary.close')).toEqual({ ok: true });
    expect(a.store.get().glossary).toBeNull();
    expect(Object.isFrozen(a.store.get())).toBe(true);
  });

  it('touches nothing else', () => {
    const a = createApp();
    const before = a.store.get();
    a.registry.run('glossary.open', { id: 'sql' });
    const after = a.store.get();
    expect(after.player).toBe(before.player);
    expect(after.depth).toBe(before.depth);
    expect(after.lesson).toBe(before.lesson);
  });

  it('rejects ids that are not term ids', () => {
    const a = createApp();
    for (const id of ['', 'SQL', '<b>', 'a'.repeat(40), 42, null]) {
      const result = a.registry.run('glossary.open', { id });
      expect(result.ok).toBe(false);
    }
    expect(a.store.get().glossary).toBeNull();
  });

  it('closing when closed changes nothing', () => {
    const a = createApp();
    const before = a.store.get();
    a.registry.run('glossary.close');
    expect(a.store.get()).toBe(before);
  });
});
