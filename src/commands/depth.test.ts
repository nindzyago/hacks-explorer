// M1.4, scenario S3: `depth.set` chooses the depth of the explanation; it touches nothing else.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

function app() {
  const created = createApp();
  created.lessonLoaded('I1', { without: 5, with: 6 });
  return created;
}

describe('depth.set (S3)', () => {
  it('starts at «Просто» and is listed with its three values', () => {
    const a = app();
    expect(a.store.get().depth).toBe('simple');
    expect(a.registry.list()).toContainEqual({
      id: 'depth.set',
      titleKey: 'command.depth.set',
      params: { depth: { kind: 'enum', values: ['simple', 'steps', 'deep'] } },
      enabled: true,
    });
  });

  it('sets each depth and leaves the step and the defence mode alone', () => {
    const a = app();
    a.registry.run('player.goto', { step: 3 });
    const player = a.store.get().player;
    for (const depth of ['simple', 'steps', 'deep'] as const) {
      expect(a.registry.run('depth.set', { depth })).toEqual({ ok: true });
      expect(a.store.get().depth).toBe(depth);
      expect(a.store.get().player).toBe(player);
    }
    expect(Object.isFrozen(a.store.get())).toBe(true);
  });

  it('keeps the depth when the step, the mode or the lesson changes', () => {
    const a = app();
    a.registry.run('depth.set', { depth: 'deep' });
    a.registry.run('player.step');
    a.registry.run('player.back');
    a.registry.run('player.goto', { step: 4 });
    a.registry.run('defence.toggle');
    a.registry.run('lesson.open', { id: 'B1' });
    expect(a.store.get().depth).toBe('deep');
  });

  it('setting the current depth again changes nothing', () => {
    const a = app();
    const before = a.store.get();
    expect(a.registry.run('depth.set', { depth: 'simple' })).toEqual({ ok: true });
    expect(a.store.get()).toBe(before);
  });

  it.each([
    [undefined],
    [null],
    [[]],
    [{}],
    [{ depth: 'detailed' }],
    [{ depth: 'DEEP' }],
    [{ depth: 2 }],
    [{ depth: ['deep'] }],
    [{ depth: { toString: 'deep' } }],
    [{ depth: 'deep', extra: 1 }],
    [{ depth: 'x'.repeat(100_000) }],
    [JSON.parse('{"__proto__": {"depth": "deep"}}')],
  ])('rejects %j as invalid-params and keeps the state', (params) => {
    const a = app();
    const before = a.store.get();
    expect(a.registry.run('depth.set', params)).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(a.store.get()).toBe(before);
  });
});
