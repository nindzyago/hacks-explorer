// Acceptance for M0.3 at unit level: the control channel is a thin, total, plain-data view of
// the registry and the state. The browser side is covered by e2e/control.spec.ts.
import { describe, expect, it } from 'vitest';
import { createApp } from '../commands/app';
import { createControl, installControl, type AppControl } from './control';

const viaJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('createControl', () => {
  it('lists commands as plain data that survives JSON', () => {
    const control = createControl(createApp());
    const list = control.commands.list();
    expect(list.map((command) => command.id)).toContain('theme.set');
    expect(viaJson(list)).toEqual(list);
  });

  it('runs a command by id and shows the change in the state', () => {
    const control = createControl(createApp());
    expect(control.state.get()).toEqual({ theme: 'light' });
    expect(control.commands.run('theme.set', { theme: 'dark' })).toEqual({ ok: true });
    expect(control.state.get()).toEqual({ theme: 'dark' });
    expect(viaJson(control.state.get())).toEqual(control.state.get());
  });

  it('hands out copies: changing a result does not change the application', () => {
    const app = createApp();
    const control = createControl(app);
    const state: { theme: string } = control.state.get();
    state.theme = 'broken';
    expect(app.store.get()).toEqual({ theme: 'light' });
    expect(control.state.get()).toEqual({ theme: 'light' });

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
  });
});

describe('installControl', () => {
  it('puts the channel on the given object as __app', () => {
    const target: { __app?: AppControl } = {};
    const control = installControl(target, createApp());
    expect(target.__app).toBe(control);
    expect(target.__app?.commands.run('theme.set', { theme: 'dark' })).toEqual({ ok: true });
    expect(target.__app?.state.get()).toEqual({ theme: 'dark' });
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
