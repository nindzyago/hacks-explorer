import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('createApp', () => {
  it('starts from the initial state with the application commands registered', () => {
    const app = createApp();
    expect(app.store.get()).toMatchObject({ theme: 'light' });
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
      expect(app.store.get()).toMatchObject({ theme: 'light' });
    },
  );
});

describe('player clock (M0.4)', () => {
  it('has a player clock of its own, moved by the clock commands', () => {
    const app = createApp();
    const other = createApp();
    expect(app.registry.list().map((command) => command.id)).toEqual(
      expect.arrayContaining(['clock.set', 'clock.tick']),
    );
    expect(app.registry.run('clock.tick', { ms: 30 })).toEqual({ ok: true });
    expect(app.clock.now()).toBe(30);
    expect(other.clock.now()).toBe(0);
    // The clock is not part of the stored state: a step does not wake the store's subscribers.
    expect(app.store.get()).toMatchObject({ theme: 'light' });
  });

  it('tells the caller before every manual move of the clock', () => {
    const moves: number[] = [];
    const app = createApp({ onManualClock: () => moves.push(app.clock.now()) });
    app.registry.run('clock.tick', { ms: 10 });
    app.registry.run('clock.set', { ms: 500 });
    app.registry.run('clock.tick', { ms: -1 });
    app.registry.run('theme.set', { theme: 'dark' });
    expect(moves).toEqual([0, 10]);
  });
});
