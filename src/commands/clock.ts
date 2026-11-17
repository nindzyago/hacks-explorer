/**
 * Clock commands for the control channel (architecture §4): `clock.set` and `clock.tick`.
 * Tests and the channel move the player clock by hand through these; the real-time driver is
 * switched off first, so wall time never mixes into a scripted run.
 */
import { MAX_TIME_MS, type Clock, type ClockResult } from '../core/clock';
import type { CommandRegistry, RunResult } from './registry';

export interface ClockCommandsOptions {
  /** Called before every manual move of the clock; pass the real-time driver's `stop` here. */
  readonly onManual?: (() => void) | undefined;
}

function orThrow(result: ClockResult): void {
  // The registry turns this into `{ code: 'failed' }` with the clock's own code in the message.
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
}

/**
 * Registers `clock.set { ms }` and `clock.tick { ms }` on `registry`.
 * @throws {CommandDefinitionError} when these ids are already registered.
 */
export function registerClockCommands<State>(
  registry: CommandRegistry<State>,
  clock: Clock,
  options: ClockCommandsOptions = {},
): void {
  const { onManual } = options;
  registry.register({
    id: 'clock.set',
    titleKey: 'command.clock.set',
    params: { ms: { kind: 'integer', min: 0, max: MAX_TIME_MS } },
    run: ({ ms }) => {
      onManual?.();
      orThrow(clock.set(ms));
    },
  });
  registry.register({
    id: 'clock.tick',
    titleKey: 'command.clock.tick',
    params: { ms: { kind: 'integer', min: 0, max: clock.maxTickMs } },
    run: ({ ms }) => {
      onManual?.();
      orThrow(clock.tick(ms));
    },
  });
}

/** The `clock` part of `window.__app`: plain functions that run the commands by id. */
export interface ClockChannel {
  set(ms: unknown): RunResult;
  tick(ms: unknown): RunResult;
}

/** `registry` must already have the clock commands (`registerClockCommands`). Never throws. */
export function createClockChannel<State>(
  registry: Pick<CommandRegistry<State>, 'run'>,
): ClockChannel {
  return {
    set: (ms) => registry.run('clock.set', { ms }),
    tick: (ms) => registry.run('clock.tick', { ms }),
  };
}
