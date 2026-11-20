// M6.2: `view.set` chooses the scene or the sequence view; it touches nothing else.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

function app() {
  const created = createApp({ languages: ['ru', 'en'] });
  created.lessonLoaded('I1', { without: 5, with: 6 });
  return created;
}

describe('view.set', () => {
  it('starts on the scene and is listed with its two values', () => {
    const a = app();
    expect(a.store.get().view).toBe('scene');
    expect(a.registry.list()).toContainEqual({
      id: 'view.set',
      titleKey: 'command.view.set',
      params: { view: { kind: 'enum', values: ['scene', 'sequence'] } },
      enabled: true,
    });
  });

  it('sets each view and leaves the player, the depth and the lesson alone', () => {
    const a = app();
    a.registry.run('player.goto', { step: 3 });
    a.registry.run('depth.set', { depth: 'deep' });
    const before = a.store.get();
    for (const view of ['sequence', 'scene', 'sequence'] as const) {
      expect(a.registry.run('view.set', { view })).toEqual({ ok: true });
      const now = a.store.get();
      expect(now.view).toBe(view);
      expect(now.player).toBe(before.player);
      expect({ ...now, view: before.view }).toEqual(before);
    }
    expect(Object.isFrozen(a.store.get())).toBe(true);
  });

  it('keeps the view when the step, the mode, the lesson or the language changes', () => {
    const a = app();
    a.registry.run('view.set', { view: 'sequence' });
    a.registry.run('player.step');
    a.registry.run('player.back');
    a.registry.run('player.goto', { step: 4 });
    a.registry.run('defence.toggle');
    a.registry.run('lesson.open', { id: 'B1' });
    a.registry.run('locale.set', { lang: 'en' });
    a.registry.run('drawer.open', { tab: 'lessons' });
    a.registry.run('drawer.close');
    expect(a.store.get().view).toBe('sequence');
  });

  it('setting the current view again changes nothing', () => {
    const a = app();
    const before = a.store.get();
    expect(a.registry.run('view.set', { view: 'scene' })).toEqual({ ok: true });
    expect(a.store.get()).toBe(before);
  });

  it.each([
    [undefined],
    [null],
    [[]],
    [{}],
    [{ view: 'map' }],
    [{ view: 'SEQUENCE' }],
    [{ view: 1 }],
    [{ view: ['sequence'] }],
    [{ view: 'sequence', extra: 1 }],
    [{ view: 'x'.repeat(100_000) }],
    [JSON.parse('{"__proto__": {"view": "sequence"}}')],
  ])('rejects %j as invalid-params and keeps the state', (params) => {
    const a = app();
    const before = a.store.get();
    expect(a.registry.run('view.set', params)).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(a.store.get()).toBe(before);
  });
});
