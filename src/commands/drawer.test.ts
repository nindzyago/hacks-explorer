// M2.1b: `drawer.open` and `drawer.close` — the side panel with the lessons and the glossary.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('drawer.open / drawer.close', () => {
  it('starts closed, opens on the lessons tab by default, switches tab and closes', () => {
    const a = createApp();
    expect(a.store.get().drawer).toBeNull();
    expect(a.registry.run('drawer.open')).toEqual({ ok: true });
    expect(a.store.get().drawer).toBe('lessons');
    a.registry.run('drawer.open', { tab: 'glossary' });
    expect(a.store.get().drawer).toBe('glossary');
    expect(a.registry.run('drawer.close')).toEqual({ ok: true });
    expect(a.store.get().drawer).toBeNull();
    expect(Object.isFrozen(a.store.get())).toBe(true);
  });

  it('a term opened in the panel closes with the panel and with a switch of tab', () => {
    const a = createApp();
    a.registry.run('drawer.open', { tab: 'glossary' });
    a.registry.run('glossary.open', { id: 'sql' });
    expect(a.store.get()).toMatchObject({ drawer: 'glossary', glossary: 'sql' });
    a.registry.run('drawer.open', { tab: 'glossary' });
    expect(a.store.get().glossary).toBeNull();
    a.registry.run('glossary.open', { id: 'sql' });
    a.registry.run('drawer.close');
    expect(a.store.get()).toMatchObject({ drawer: null, glossary: null });
  });

  it('touches nothing else; closing when closed changes nothing', () => {
    const a = createApp();
    const before = a.store.get();
    a.registry.run('drawer.close');
    expect(a.store.get()).toBe(before);
    a.registry.run('glossary.open', { id: 'sql' });
    const withTerm = a.store.get();
    // A definition open in place is not the panel's.
    a.registry.run('drawer.close');
    expect(a.store.get()).toBe(withTerm);
    a.registry.run('drawer.open');
    const after = a.store.get();
    expect(after.player).toBe(before.player);
    expect(after.lesson).toBe(before.lesson);
    expect(after.depth).toBe(before.depth);
    expect(after.locale).toBe(before.locale);
  });

  it('rejects tabs that are not tabs', () => {
    const a = createApp();
    for (const tab of ['', 'Lessons', 'settings', 42, null, '<b>']) {
      expect(a.registry.run('drawer.open', { tab }).ok).toBe(false);
    }
    expect(a.store.get().drawer).toBeNull();
  });
});
