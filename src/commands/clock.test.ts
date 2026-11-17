// Oracle: level D (architecture §4: `clock.set(ms)`, `clock.tick(ms)` through the control
// channel; "everything is a command"), exact asserts.
import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS, createClock } from '../core/clock';
import { createClockChannel, registerClockCommands } from './clock';
import { createRegistry } from './registry';

function setup() {
  const clock = createClock();
  const registry = createRegistry<null>(() => null);
  const manual: string[] = [];
  registerClockCommands(registry, clock, { onManual: () => manual.push('manual') });
  return { clock, registry, manual, channel: createClockChannel(registry) };
}

describe('clock commands', () => {
  it('registers clock.set and clock.tick with integer parameters', () => {
    const { registry } = setup();
    expect(registry.list()).toEqual([
      {
        id: 'clock.set',
        titleKey: 'command.clock.set',
        params: { ms: { kind: 'integer', min: 0, max: MAX_TIME_MS } },
        enabled: true,
      },
      {
        id: 'clock.tick',
        titleKey: 'command.clock.tick',
        params: { ms: { kind: 'integer', min: 0, max: 10_000 } },
        enabled: true,
      },
    ]);
  });

  it('moves the clock by id', () => {
    const { clock, registry } = setup();
    expect(registry.run('clock.tick', { ms: 25 })).toEqual({ ok: true });
    expect(clock.snapshot()).toEqual({ timeMs: 20, pendingMs: 5, stepMs: 10 });
    expect(registry.run('clock.set', { ms: 500 })).toEqual({ ok: true });
    expect(clock.now()).toBe(500);
  });

  it('the channel functions are the same commands', () => {
    const { clock, channel } = setup();
    expect(channel.tick(40)).toEqual({ ok: true });
    expect(channel.tick(60)).toEqual({ ok: true });
    expect(clock.now()).toBe(100);
    expect(channel.set(30)).toEqual({ ok: true });
    expect(clock.now()).toBe(30);
  });

  it('rejects hostile values before they reach the clock', () => {
    const { clock, registry, channel, manual } = setup();
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
      true,
    ];
    for (const ms of hostile) {
      expect(channel.tick(ms)).toMatchObject({ ok: false, error: { code: 'invalid-params' } });
      expect(channel.set(ms)).toMatchObject({ ok: false, error: { code: 'invalid-params' } });
    }
    expect(channel.tick(10_001)).toMatchObject({ ok: false, error: { code: 'invalid-params' } });
    expect(channel.set(MAX_TIME_MS + 1)).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(registry.run('clock.tick', { ms: 10, extra: 1 })).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(registry.run('clock.tick')).toMatchObject({
      ok: false,
      error: { code: 'invalid-params' },
    });
    expect(clock.snapshot()).toEqual({ timeMs: 0, pendingMs: 0, stepMs: 10 });
    expect(manual).toEqual([]);
  });

  it('reports a refusal of the clock as a failed command with the clock code', () => {
    const { registry, clock } = setup();
    expect(registry.run('clock.set', { ms: MAX_TIME_MS })).toEqual({ ok: true });
    const result = registry.run('clock.tick', { ms: 10 });
    expect(result).toMatchObject({ ok: false, error: { code: 'failed', commandId: 'clock.tick' } });
    if (!result.ok) expect(result.error.message).toContain('out-of-range');
    expect(clock.now()).toBe(MAX_TIME_MS);
  });

  it('switches the real-time driver off before every manual move', () => {
    const { registry, manual } = setup();
    registry.run('clock.tick', { ms: 10 });
    registry.run('clock.set', { ms: 0 });
    expect(manual).toEqual(['manual', 'manual']);
  });

  it('works without the onManual hook, and a throwing hook leaves the clock alone', () => {
    const clock = createClock();
    const registry = createRegistry<null>(() => null);
    registerClockCommands(registry, clock);
    expect(registry.run('clock.tick', { ms: 10 })).toEqual({ ok: true });

    const other = createClock();
    const otherRegistry = createRegistry<null>(() => null);
    registerClockCommands(otherRegistry, other, {
      onManual: () => {
        throw new Error('driver is stuck');
      },
    });
    expect(otherRegistry.run('clock.tick', { ms: 10 })).toMatchObject({
      ok: false,
      error: { code: 'failed' },
    });
    expect(other.now()).toBe(0);
  });
});
