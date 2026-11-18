// M1.3: player commands (architecture §3) — `player.*`, `defence.*` and `lesson.open` — and
// autoplay by the player clock. They replace the temporary `scene.step` / `scene.defence` of M1.2.
import { describe, expect, it } from 'vitest';
import { MAX_STEPS, PAUSE_MS, stepDurationMs } from '../core/player/player';
import { TRAVEL_MS } from '../core/scene-layout/message';
import { createApp, type AppOptions } from './app';

const B1 = { without: 5, with: 5 };

function loaded(options: AppOptions = {}) {
  const app = createApp(options);
  app.lessonLoaded('B1', B1);
  return app;
}

const player = (app: ReturnType<typeof createApp>) => app.store.get().player;

describe('player state', () => {
  it('starts at step 1 of B1 without the defence, paused, at speed 1', () => {
    expect(createApp().store.get()).toEqual({
      theme: 'light',
      lesson: 'B1',
      player: {
        step: 1,
        defence: false,
        startedMs: 0,
        playing: false,
        speed: 1,
        counts: { without: 0, with: 0 },
      },
    });
  });

  it('is frozen all the way down', () => {
    const state = loaded().store.get();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.player)).toBe(true);
    expect(Object.isFrozen(state.player.counts)).toBe(true);
  });

  it('the scene registers the steps of the loaded lesson only for the open lesson', () => {
    const app = createApp();
    app.lessonLoaded('I1', { without: 9, with: 9 });
    expect(player(app).counts).toEqual({ without: 0, with: 0 });
    app.lessonLoaded('B1', B1);
    expect(player(app).counts).toEqual(B1);
  });

  it('the old temporary commands are gone', () => {
    const ids = createApp()
      .registry.list()
      .map((c) => c.id);
    expect(ids).not.toContain('scene.step');
    expect(ids).not.toContain('scene.defence');
    expect(ids).toEqual(
      expect.arrayContaining([
        'player.play',
        'player.pause',
        'player.step',
        'player.back',
        'player.goto',
        'player.speed',
        'defence.toggle',
        'defence.set',
        'lesson.open',
      ]),
    );
  });
});

describe('player.step and player.back (S1)', () => {
  it('three steps reach step 4; back gives exactly the state of step 3', () => {
    const app = loaded();
    app.registry.run('player.step');
    expect(app.registry.run('player.step')).toEqual({ ok: true });
    const third = app.store.get();
    app.registry.run('player.step');
    expect(player(app).step).toBe(4);
    expect(app.registry.run('player.back')).toEqual({ ok: true });
    expect(app.store.get()).toEqual(third);
  });

  it('starts the step at the time of the player clock', () => {
    const app = loaded();
    app.clock.set(1234);
    app.registry.run('player.step');
    expect(player(app)).toMatchObject({ step: 2, startedMs: 1230 });
  });

  it('is accepted and changes nothing at the ends', () => {
    const app = loaded();
    const before = app.store.get();
    expect(app.registry.run('player.back')).toEqual({ ok: true });
    expect(app.store.get()).toBe(before);
    app.registry.run('player.goto', { step: 5 });
    const last = app.store.get();
    expect(app.registry.run('player.step')).toEqual({ ok: true });
    expect(app.store.get()).toBe(last);
  });

  it.each([[{ step: 1 }], [{ extra: true }], ['x']])('rejects params %j', (params) => {
    const app = loaded();
    expect(app.registry.run('player.step', params)).toMatchObject({ ok: false });
    expect(app.registry.run('player.back', params)).toMatchObject({ ok: false });
    expect(player(app).step).toBe(1);
  });
});

describe('player.goto', () => {
  it('chooses the step, keeps the mode, starts it now; past the end is the last', () => {
    const app = loaded();
    app.registry.run('defence.set', { on: true });
    app.clock.set(300);
    expect(app.registry.run('player.goto', { step: 4 })).toEqual({ ok: true });
    expect(player(app)).toMatchObject({ step: 4, defence: true, startedMs: 300 });
    app.registry.run('player.goto', { step: MAX_STEPS });
    expect(player(app).step).toBe(5);
  });

  it('the same step again is a replay', () => {
    const app = loaded();
    app.registry.run('player.goto', { step: 2 });
    app.clock.set(500);
    app.registry.run('player.goto', { step: 2 });
    expect(player(app).startedMs).toBe(500);
  });

  it.each([
    [undefined],
    [{}],
    [{ step: 0 }],
    [{ step: -1 }],
    [{ step: 1.5 }],
    [{ step: '3' }],
    [{ step: MAX_STEPS + 1 }],
    [{ step: Number.NaN }],
    [{ step: 1e9 }],
    [{ step: 3, extra: true }],
  ])('rejects %j and keeps the state', (params) => {
    const app = loaded();
    const before = app.store.get();
    expect(app.registry.run('player.goto', params)).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(app.store.get()).toBe(before);
  });
});

describe('defence.toggle and defence.set', () => {
  it('switch the mode, keep the step number and start the step again (S2)', () => {
    const app = loaded();
    app.registry.run('player.goto', { step: 3 });
    app.clock.set(700);
    expect(app.registry.run('defence.toggle')).toEqual({ ok: true });
    expect(player(app)).toMatchObject({ step: 3, defence: true, startedMs: 700 });
    expect(app.registry.run('defence.toggle', {})).toEqual({ ok: true });
    expect(player(app)).toMatchObject({ step: 3, defence: false, startedMs: 700 });
    app.registry.run('defence.set', { on: true });
    expect(player(app).defence).toBe(true);
  });

  it('stop playing', () => {
    const app = loaded();
    app.registry.run('player.play');
    app.registry.run('defence.toggle');
    expect(player(app).playing).toBe(false);
  });

  it.each([[{ on: 'yes' }], [{ on: 1 }], [null], [{ x: 1 }]])('defence.set rejects %j', (p) => {
    const app = loaded();
    expect(app.registry.run('defence.set', p)).toMatchObject({ ok: false });
    expect(app.registry.run('defence.toggle', { on: true })).toMatchObject({ ok: false });
    expect(player(app).defence).toBe(false);
  });
});

describe('player.play, player.pause and autoplay', () => {
  it('plays by the player clock and stops at the end of the lesson', () => {
    const app = loaded();
    app.clock.set(0);
    // Step 1 of the page load is still travelling at time 0: it finishes first.
    app.registry.run('player.play');
    expect(player(app)).toMatchObject({ step: 1, playing: true });
    const d = stepDurationMs(1);
    app.clock.tick(d - 10);
    expect(player(app).step).toBe(1);
    app.clock.tick(10);
    expect(player(app)).toMatchObject({ step: 2, startedMs: d });
    for (let i = 0; i < 3; i += 1) app.clock.tick(d);
    expect(player(app)).toMatchObject({ step: 5, playing: true });
    app.clock.tick(TRAVEL_MS);
    expect(player(app)).toMatchObject({ step: 5, playing: false });
  });

  it('pause stops autoplay where it is', () => {
    const app = loaded();
    app.registry.run('player.play');
    app.clock.tick(TRAVEL_MS);
    expect(app.registry.run('player.pause')).toEqual({ ok: true });
    app.clock.tick(PAUSE_MS * 4);
    expect(player(app)).toMatchObject({ step: 1, playing: false });
  });

  it('play and pause twice change nothing the second time', () => {
    const app = loaded();
    app.registry.run('player.play');
    const playing = app.store.get();
    app.registry.run('player.play');
    expect(app.store.get()).toBe(playing);
    app.registry.run('player.pause');
    const paused = app.store.get();
    app.registry.run('player.pause');
    expect(app.store.get()).toBe(paused);
  });

  it('a step by hand stops playing', () => {
    const app = loaded();
    app.registry.run('player.play');
    app.registry.run('player.step');
    expect(player(app).playing).toBe(false);
  });
});

describe('player.speed', () => {
  it('accepts 0.5, 1 and 2 and plays at that speed', () => {
    const app = loaded();
    expect(app.registry.run('player.speed', { value: 2 })).toEqual({ ok: true });
    app.registry.run('player.play');
    app.clock.tick(stepDurationMs(2));
    expect(player(app)).toMatchObject({ step: 2, speed: 2, playing: true });
    expect(app.registry.run('player.speed', { value: 0.5 })).toEqual({ ok: true });
    expect(player(app).speed).toBe(0.5);
  });

  it.each([[{ value: 1.5 }], [{ value: 0 }], [{ value: '1' }], [{ value: 3 }], [{}], [null]])(
    'rejects %j and keeps the speed',
    (params) => {
      const app = loaded();
      expect(app.registry.run('player.speed', params)).toMatchObject({ ok: false });
      expect(player(app).speed).toBe(1);
    },
  );
});

describe('lesson.open', () => {
  it('opens another lesson at step 1 without the defence, paused, steps unknown', () => {
    const app = loaded();
    app.registry.run('player.goto', { step: 4 });
    app.registry.run('defence.set', { on: true });
    app.registry.run('player.speed', { value: 2 });
    app.registry.run('player.play');
    app.clock.set(90);
    expect(app.registry.run('lesson.open', { id: 'I1' })).toEqual({ ok: true });
    expect(app.store.get()).toMatchObject({
      lesson: 'I1',
      player: {
        step: 1,
        defence: false,
        startedMs: 90,
        playing: false,
        speed: 2,
        counts: { without: 0, with: 0 },
      },
    });
  });

  // Found in the screenshots: opening the open lesson again lost its steps (the page does not
  // load it again, so nobody told the player), and the table vanished.
  it('opening the open lesson again starts it over and keeps its steps', () => {
    const app = loaded();
    app.registry.run('player.goto', { step: 4 });
    expect(app.registry.run('lesson.open', { id: 'B1' })).toEqual({ ok: true });
    expect(player(app)).toMatchObject({ step: 1, counts: B1 });
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

describe('the real-time driver follows the player (K17)', () => {
  it('asks for time while playing or while a message travels, and lets go after', () => {
    const asked: boolean[] = [];
    const app = loaded({ onTimeNeeded: (needed) => asked.push(needed) });
    // The page load: step 1 travels from time 0.
    expect(app.timeNeeded()).toBe(true);
    app.clock.tick(TRAVEL_MS);
    expect(asked).toEqual([false]);
    app.registry.run('player.play');
    expect(asked).toEqual([false, true]);
    app.registry.run('player.pause');
    // Pausing right after a new step started: its message still travels.
    expect(asked).toEqual([false, true]);
    app.clock.tick(TRAVEL_MS);
    expect(asked).toEqual([false, true, false]);
    app.registry.run('player.step');
    expect(asked).toEqual([false, true, false, true]);
  });

  it('a manual clock command still calls onManualClock', () => {
    let manual = 0;
    const app = loaded({ onManualClock: () => (manual += 1) });
    app.registry.run('player.play');
    app.registry.run('clock.tick', { ms: 10 });
    expect(manual).toBe(1);
  });
});
