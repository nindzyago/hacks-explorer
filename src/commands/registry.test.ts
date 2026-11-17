// Oracle: level D (behaviour stated by the plan row M0.2 and architecture §3–4), exact asserts.
import { describe, expect, it } from 'vitest';
import { CommandDefinitionError, createRegistry } from './registry';

interface TestState {
  lessonOpen: boolean;
}

function setup(initial: TestState = { lessonOpen: true }) {
  const state = { ...initial };
  const registry = createRegistry<TestState>(() => state);
  return { registry, state };
}

function definitionErrorOf(action: () => void): CommandDefinitionError {
  try {
    action();
  } catch (error) {
    if (error instanceof CommandDefinitionError) return error;
    throw error;
  }
  throw new Error('expected CommandDefinitionError, nothing was thrown');
}

describe('command registry: acceptance (M0.2)', () => {
  it('registers a no-op command and runs it by id', () => {
    const { registry } = setup();
    let calls = 0;
    registry.register({
      id: 'test.noop',
      titleKey: 'command.test.noop',
      params: {},
      run: () => {
        calls += 1;
      },
    });

    expect(registry.run('test.noop')).toEqual({ ok: true });
    expect(registry.run('test.noop', {})).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('passes validated, typed parameters to run', () => {
    const { registry } = setup();
    const seen: string[] = [];
    registry.register({
      id: 'player.goto',
      titleKey: 'command.player.goto',
      params: {
        step: { kind: 'integer', min: 0, max: 99 },
        mode: { kind: 'enum', values: ['plain', 'defence'] },
        note: { kind: 'string', optional: true },
        loop: { kind: 'boolean', optional: true },
        speed: { kind: 'number', min: 0.25, max: 4, optional: true },
      },
      run: (params) => {
        const mode: 'plain' | 'defence' = params.mode;
        const step: number = params.step;
        seen.push(
          `${String(step)}/${mode}/${params.note ?? '-'}/${String(params.loop)}/${String(params.speed)}`,
        );
      },
    });

    expect(registry.run('player.goto', { step: 3, mode: 'defence' })).toEqual({ ok: true });
    expect(
      registry.run('player.goto', { step: 0, mode: 'plain', note: 'x', loop: false, speed: 1.5 }),
    ).toEqual({ ok: true });
    expect(seen).toEqual(['3/defence/-/undefined/undefined', '0/plain/x/false/1.5']);
  });
});

describe('command registry: list()', () => {
  it('describes every command in registration order, with enabled computed from state', () => {
    const { registry, state } = setup({ lessonOpen: false });
    registry.register({
      id: 'test.noop',
      titleKey: 'command.test.noop',
      params: {},
      run: () => {},
    });
    registry.register({
      id: 'player.goto',
      titleKey: 'command.player.goto',
      params: { step: { kind: 'integer', min: 0, max: 99 } },
      enabled: (s) => s.lessonOpen,
      run: () => {},
    });

    expect(registry.list()).toEqual([
      { id: 'test.noop', titleKey: 'command.test.noop', params: {}, enabled: true },
      {
        id: 'player.goto',
        titleKey: 'command.player.goto',
        params: { step: { kind: 'integer', min: 0, max: 99 } },
        enabled: false,
      },
    ]);

    state.lessonOpen = true;
    expect(registry.list().map((c) => c.enabled)).toEqual([true, true]);
  });

  it('is plain data that survives JSON (the control channel sends it to Playwright)', () => {
    const { registry } = setup();
    registry.register({
      id: 'depth.set',
      titleKey: 'command.depth.set',
      params: { level: { kind: 'enum', values: ['simple', 'normal', 'deep'] } },
      run: () => {},
    });
    const listed = registry.list();
    expect(JSON.parse(JSON.stringify(listed))).toEqual(listed);
  });

  it('reports a command whose enabled() throws as disabled', () => {
    const { registry } = setup();
    registry.register({
      id: 'test.broken',
      titleKey: 'command.test.broken',
      params: {},
      enabled: () => {
        throw new Error('boom');
      },
      run: () => {},
    });
    expect(registry.list()).toEqual([
      { id: 'test.broken', titleKey: 'command.test.broken', params: {}, enabled: false },
    ]);
  });
});

describe('command registry: errors are typed results, not crashes', () => {
  it('unknown id', () => {
    const { registry } = setup();
    const result = registry.run('nope.nothing');
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unknown-command',
        commandId: 'nope.nothing',
        message: 'unknown command "nope.nothing"',
      },
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { id: 'test.noop' }],
    ['an empty string', ''],
    ['an inherited object key', 'constructor'],
    ['__proto__', '__proto__'],
  ])('hostile id: %s', (_label, id) => {
    const { registry } = setup();
    registry.register({ id: 'test.noop', titleKey: 't', params: {}, run: () => {} });
    const result = registry.run(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-command');
  });

  it('a huge id is cut in the error, not echoed back whole', () => {
    const { registry } = setup();
    const result = registry.run('x'.repeat(100_000));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-command');
      expect(result.error.commandId.length).toBeLessThanOrEqual(64);
      expect(result.error.message.length).toBeLessThan(200);
    }
  });

  it('duplicate id is refused at registration and the first command stays', () => {
    const { registry } = setup();
    const ran: string[] = [];
    registry.register({
      id: 'test.noop',
      titleKey: 'first',
      params: {},
      run: () => {
        ran.push('first');
      },
    });
    const error = definitionErrorOf(() => {
      registry.register({
        id: 'test.noop',
        titleKey: 'second',
        params: {},
        run: () => {
          ran.push('second');
        },
      });
    });
    expect(error.code).toBe('duplicate-id');
    expect(error.commandId).toBe('test.noop');
    expect(error.message).toBe('command "test.noop" is already registered');

    expect(registry.run('test.noop')).toEqual({ ok: true });
    expect(ran).toEqual(['first']);
    expect(registry.list().map((c) => c.titleKey)).toEqual(['first']);
  });

  it.each([
    ['no area', 'noop'],
    ['three segments', 'a.b.c'],
    ['upper-case area', 'Test.noop'],
    ['space', 'test. noop'],
    ['empty', ''],
    ['__proto__', '__proto__.x'],
  ])('badly named id is refused at registration: %s', (_label, id) => {
    const { registry } = setup();
    const error = definitionErrorOf(() => {
      registry.register({ id, titleKey: 't', params: {}, run: () => {} });
    });
    expect(error.code).toBe('invalid-definition');
    expect(registry.list()).toEqual([]);
  });

  it('bad definitions are refused at registration', () => {
    const { registry } = setup();
    const cases: (() => void)[] = [
      () => {
        registry.register({ id: 'a.b', titleKey: '', params: {}, run: () => {} });
      },
      () => {
        registry.register({
          id: 'a.b',
          titleKey: 't',
          params: { ['__proto__']: { kind: 'boolean' } },
          run: () => {},
        });
      },
      () => {
        registry.register({
          id: 'a.b',
          titleKey: 't',
          params: { n: { kind: 'integer', min: 5, max: 1 } },
          run: () => {},
        });
      },
      () => {
        registry.register({
          id: 'a.b',
          titleKey: 't',
          params: { e: { kind: 'enum', values: [] } },
          run: () => {},
        });
      },
    ];
    for (const action of cases) expect(definitionErrorOf(action).code).toBe('invalid-definition');
    expect(registry.list()).toEqual([]);
  });

  it('disabled command is not run', () => {
    const { registry, state } = setup({ lessonOpen: false });
    let calls = 0;
    registry.register({
      id: 'player.play',
      titleKey: 'command.player.play',
      params: {},
      enabled: (s) => s.lessonOpen,
      run: () => {
        calls += 1;
      },
    });

    expect(registry.run('player.play')).toEqual({
      ok: false,
      error: {
        code: 'disabled',
        commandId: 'player.play',
        message: 'command "player.play" is disabled in the current state',
      },
    });
    expect(calls).toBe(0);

    state.lessonOpen = true;
    expect(registry.run('player.play')).toEqual({ ok: true });
    expect(calls).toBe(1);
  });

  it('bad params are reported per parameter and the command is not run', () => {
    const { registry } = setup();
    let calls = 0;
    registry.register({
      id: 'player.goto',
      titleKey: 'command.player.goto',
      params: {
        step: { kind: 'integer', min: 0, max: 99 },
        mode: { kind: 'enum', values: ['plain', 'defence'] },
      },
      run: () => {
        calls += 1;
      },
    });

    expect(registry.run('player.goto', { step: '3', mode: 'attack', extra: 1 })).toEqual({
      ok: false,
      error: {
        code: 'invalid-params',
        commandId: 'player.goto',
        message: 'command "player.goto" got invalid parameters',
        problems: [
          { param: 'step', problem: 'must be an integer' },
          { param: 'mode', problem: 'must be one of: plain, defence' },
          { param: 'extra', problem: 'unknown parameter' },
        ],
      },
    });
    expect(calls).toBe(0);
  });

  it('params are checked before enabled, so a caller learns about a bad call in any state', () => {
    const { registry } = setup({ lessonOpen: false });
    registry.register({
      id: 'player.goto',
      titleKey: 't',
      params: { step: { kind: 'integer', min: 0, max: 99 } },
      enabled: (s) => s.lessonOpen,
      run: () => {},
    });
    const bad = registry.run('player.goto', { step: -1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('invalid-params');
    const good = registry.run('player.goto', { step: 1 });
    expect(good.ok).toBe(false);
    if (!good.ok) expect(good.error.code).toBe('disabled');
  });

  it('a command that throws is reported as failed, and the registry keeps working', () => {
    const { registry } = setup();
    registry.register({
      id: 'test.throws',
      titleKey: 't',
      params: {},
      run: () => {
        throw new Error('disk on fire');
      },
    });
    registry.register({ id: 'test.noop', titleKey: 't', params: {}, run: () => {} });

    expect(registry.run('test.throws')).toEqual({
      ok: false,
      error: {
        code: 'failed',
        commandId: 'test.throws',
        message: 'command "test.throws" failed: disk on fire',
      },
    });
    expect(registry.run('test.noop')).toEqual({ ok: true });
  });

  it('enabled() that throws is reported as failed and the command is not run', () => {
    const { registry } = setup();
    let calls = 0;
    registry.register({
      id: 'test.broken',
      titleKey: 't',
      params: {},
      enabled: () => {
        throw new Error('boom');
      },
      run: () => {
        calls += 1;
      },
    });
    const result = registry.run('test.broken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('failed');
    expect(calls).toBe(0);
  });
});
