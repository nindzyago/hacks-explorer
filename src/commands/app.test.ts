import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('createApp', () => {
  it('starts from the initial state with the application commands registered', () => {
    const app = createApp();
    expect(app.store.get()).toEqual({ theme: 'light' });
    expect(app.registry.list()).toContainEqual({
      id: 'theme.set',
      titleKey: 'command.theme.set',
      params: { theme: { kind: 'enum', values: ['light', 'dark'] } },
      enabled: true,
    });
  });

  it('gives every app its own state', () => {
    const first = createApp();
    const second = createApp();
    first.registry.run('theme.set', { theme: 'dark' });
    expect(first.store.get().theme).toBe('dark');
    expect(second.store.get().theme).toBe('light');
  });
});

describe('theme.set', () => {
  it('changes the theme and tells subscribers', () => {
    const app = createApp();
    const seen: string[] = [];
    app.store.subscribe((state) => seen.push(state.theme));
    expect(app.registry.run('theme.set', { theme: 'dark' })).toEqual({ ok: true });
    expect(app.registry.run('theme.set', { theme: 'light' })).toEqual({ ok: true });
    expect(seen).toEqual(['light', 'dark', 'light']);
    expect(Object.isFrozen(app.store.get())).toBe(true);
  });

  it('setting the current theme again is accepted and changes nothing', () => {
    const app = createApp();
    const before = app.store.get();
    expect(app.registry.run('theme.set', { theme: 'light' })).toEqual({ ok: true });
    expect(app.store.get()).toBe(before);
  });

  it.each([[undefined], [{}], [{ theme: 'blue' }], [{ theme: 1 }], [{ theme: 'dark', extra: 1 }]])(
    'rejects %j and keeps the state',
    (params) => {
      const app = createApp();
      const result = app.registry.run('theme.set', params);
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid-params' } });
      expect(app.store.get()).toEqual({ theme: 'light' });
    },
  );
});
