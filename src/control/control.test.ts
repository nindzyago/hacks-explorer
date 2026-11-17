// Acceptance for M0.3 at unit level: the control channel is a thin, total, plain-data view of
// the registry and the state. The browser side is covered by e2e/control.spec.ts.
import { describe, expect, it } from 'vitest';
import { createApp } from '../commands/app';
import { createControl, installControl, type AppControl } from './control';

const viaJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const CLOCK_AT_ZERO = { timeMs: 0, pendingMs: 0, stepMs: 10 };

describe('createControl', () => {
  it('lists commands as plain data that survives JSON', () => {
    const control = createControl(createApp());
    const list = control.commands.list();
    expect(list.map((command) => command.id)).toContain('theme.set');
    expect(viaJson(list)).toEqual(list);
  });

  it('runs a command by id and shows the change in the state', () => {
    const control = createControl(createApp());
    expect(control.state.get()).toEqual({ theme: 'light', clock: CLOCK_AT_ZERO });
    expect(control.commands.run('theme.set', { theme: 'dark' })).toEqual({ ok: true });
    expect(control.state.get()).toEqual({ theme: 'dark', clock: CLOCK_AT_ZERO });
    expect(viaJson(control.state.get())).toEqual(control.state.get());
  });

  it('hands out copies: changing a result does not change the application', () => {
    const app = createApp();
    const control = createControl(app);
    const state: { theme: string } = control.state.get();
    state.theme = 'broken';
    expect(app.store.get()).toEqual({ theme: 'light' });
    expect(control.state.get()).toEqual({ theme: 'light', clock: CLOCK_AT_ZERO });

    const list = control.commands.list();
    const count = list.length;
    list.length = 0;
    expect(control.commands.list()).toHaveLength(count);
    expect(Object.isFrozen(control.commands.list()[0]?.params)).toBe(false);
  });

  it('answers hostile calls with an error, never an exception', () => {
    const app = createApp();
    const control = createControl(app);
    const throwing = {
      get theme(): string {
        throw new Error('boom');
      },
    };
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('boom');
        },
      },
    );
    const calls: [unknown, unknown][] = [
      [undefined, undefined],
      [null, null],
      [42, {}],
      ['', {}],
      ['no.such', {}],
      ['x'.repeat(100_000), {}],
      ['theme.set', undefined],
      ['theme.set', 'dark'],
      ['theme.set', ['dark']],
      ['theme.set', { theme: 'x'.repeat(1_000_000) }],
      ['theme.set', { theme: -1 }],
      ['theme.set', throwing],
      ['theme.set', proxy],
      [{ toString: () => 'theme.set' }, { theme: 'dark' }],
    ];
    for (const [id, params] of calls) {
      const result = control.commands.run(id, params);
      expect(result.ok).toBe(false);
      expect(viaJson(result)).toEqual(result);
    }
    expect(app.store.get()).toEqual({ theme: 'light' });
  });

  it('cannot be changed from outside', () => {
    const control = createControl(createApp());
    expect(Object.isFrozen(control)).toBe(true);
    expect(Object.isFrozen(control.commands)).toBe(true);
    expect(Object.isFrozen(control.state)).toBe(true);
    expect(Object.isFrozen(control.clock)).toBe(true);
  });

  // M0.4: the clock part of the channel (architecture §4).
  it('moves the player clock and shows it in the state', () => {
    const app = createApp();
    const control = createControl(app);
    expect(control.clock.tick(25)).toEqual({ ok: true });
    expect(control.state.get().clock).toEqual({ timeMs: 20, pendingMs: 5, stepMs: 10 });
    expect(control.clock.set(1234)).toEqual({ ok: true });
    expect(control.state.get()).toEqual({
      theme: 'light',
      clock: { timeMs: 1230, pendingMs: 4, stepMs: 10 },
    });
    expect(app.clock.now()).toBe(1230);
    expect(viaJson(control.state.get())).toEqual(control.state.get());
    // The same thing as the commands, so one move stops the real-time driver either way.
    expect(control.commands.run('clock.tick', { ms: 6 })).toEqual({ ok: true });
    expect(control.state.get().clock.timeMs).toBe(1240);
  });

  it('the clock in the state is a copy', () => {
    const control = createControl(createApp());
    const state: { clock: { timeMs: number } } = control.state.get();
    state.clock.timeMs = 999;
    expect(control.state.get().clock.timeMs).toBe(0);
  });

  it('clock calls with hostile values return an error as data', () => {
    const app = createApp();
    const control = createControl(app);
    const throwing = {
      valueOf(): number {
        throw new Error('boom');
      },
    };
    const hostile: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      0.5,
      1e300,
      '10',
      null,
      undefined,
      {},
      [1],
      throwing,
      () => 1,
      Symbol('ms'),
    ];
    for (const ms of hostile) {
      for (const result of [control.clock.tick(ms), control.clock.set(ms)]) {
        expect(result).toMatchObject({ ok: false, error: { code: 'invalid-params' } });
        expect(viaJson(result)).toEqual(result);
      }
    }
    expect(control.clock.tick(10_001)).toMatchObject({ ok: false });
    expect(app.clock.snapshot()).toEqual(CLOCK_AT_ZERO);
  });
});

describe('installControl', () => {
  it('puts the channel on the given object as __app', () => {
    const target: { __app?: AppControl } = {};
    const control = installControl(target, createApp());
    expect(target.__app).toBe(control);
    expect(target.__app?.commands.run('theme.set', { theme: 'dark' })).toEqual({ ok: true });
    expect(target.__app?.state.get()).toEqual({ theme: 'dark', clock: CLOCK_AT_ZERO });
  });

  it('cannot be replaced by a page script', () => {
    const target: { __app?: AppControl } = {};
    const control = installControl(target, createApp());
    expect(() => {
      target.__app = createControl(createApp());
    }).toThrow(TypeError);
    expect(target.__app).toBe(control);
  });
});
