// M1.2b (design M1.2 E10): temporary commands that choose the step and the defence mode of the
// scene until the player (M1.3) replaces them, and `lesson.open` for the one-page site. The step
// starts at the time of the player clock when the command runs; the message moves from there.
import { describe, expect, it } from 'vitest';
import { MAX_STEP } from '../core/state';
import { createApp } from './app';

describe('scene state', () => {
  it('starts at step 1 of B1 without the defence, at clock time 0', () => {
    expect(createApp().store.get()).toEqual({
      theme: 'light',
      lesson: 'B1',
      scene: { step: 1, defence: false, startedMs: 0 },
    });
  });

  it('is frozen all the way down', () => {
    const state = createApp().store.get();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.scene)).toBe(true);
  });
});

describe('scene.step', () => {
  it('chooses the step and starts it at the time of the player clock', () => {
    const app = createApp();
    app.clock.set(1234);
    expect(app.registry.run('scene.step', { step: 3 })).toEqual({ ok: true });
    expect(app.store.get().scene).toEqual({ step: 3, defence: false, startedMs: 1230 });
    expect(Object.isFrozen(app.store.get().scene)).toBe(true);
  });

  // M1.2c (a mutation the M1.2b verifier saw survive): choosing a step keeps the mode.
  it('keeps the defence mode on and off', () => {
    const app = createApp();
    app.registry.run('scene.defence', { on: true });
    app.clock.set(300);
    app.registry.run('scene.step', { step: 4 });
    expect(app.store.get().scene).toEqual({ step: 4, defence: true, startedMs: 300 });
    app.registry.run('scene.defence', { on: false });
    app.registry.run('scene.step', { step: 2 });
    expect(app.store.get().scene.defence).toBe(false);
  });

  it('starts the same step again when run again (a replay)', () => {
    const app = createApp();
    app.registry.run('scene.step', { step: 2 });
    app.clock.set(500);
    app.registry.run('scene.step', { step: 2 });
    expect(app.store.get().scene.startedMs).toBe(500);
  });

  it.each([
    [undefined],
    [{}],
    [{ step: 0 }],
    [{ step: -1 }],
    [{ step: 1.5 }],
    [{ step: '3' }],
    [{ step: MAX_STEP + 1 }],
    [{ step: Number.NaN }],
    [{ step: 3, extra: true }],
  ])('rejects %j and keeps the state', (params) => {
    const app = createApp();
    const before = app.store.get();
    expect(app.registry.run('scene.step', params)).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(app.store.get()).toBe(before);
  });
});

describe('scene.defence', () => {
  it('switches the mode, keeps the step number and starts the step again (S2)', () => {
    const app = createApp();
    app.registry.run('scene.step', { step: 3 });
    app.clock.set(700);
    expect(app.registry.run('scene.defence', { on: true })).toEqual({ ok: true });
    expect(app.store.get().scene).toEqual({ step: 3, defence: true, startedMs: 700 });
    app.registry.run('scene.defence', { on: false });
    expect(app.store.get().scene).toEqual({ step: 3, defence: false, startedMs: 700 });
  });

  it.each([[{}], [{ on: 'yes' }], [{ on: 1 }], [null]])('rejects %j', (params) => {
    const app = createApp();
    expect(app.registry.run('scene.defence', params)).toMatchObject({ ok: false });
    expect(app.store.get().scene.defence).toBe(false);
  });
});

describe('lesson.open', () => {
  it('opens another lesson at step 1 without the defence', () => {
    const app = createApp();
    app.registry.run('scene.step', { step: 4 });
    app.registry.run('scene.defence', { on: true });
    app.clock.set(90);
    expect(app.registry.run('lesson.open', { id: 'I1' })).toEqual({ ok: true });
    expect(app.store.get()).toMatchObject({
      lesson: 'I1',
      scene: { step: 1, defence: false, startedMs: 90 },
    });
  });

  it.each([[{}], [{ id: 7 }], [{ id: 'x'.repeat(33) }], [{ id: '' }], [{ id: 'B1/../x' }]])(
    'rejects %j',
    (params) => {
      const app = createApp();
      expect(app.registry.run('lesson.open', params)).toMatchObject({ ok: false });
      expect(app.store.get().lesson).toBe('B1');
    },
  );
});
