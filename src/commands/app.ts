/**
 * The application as the adapters see it: one state store, one player clock and one command
 * registry.
 * `src/main.ts` creates it once and hands it to the interface and to the control channel.
 */
import { createClock, type Clock } from '../core/clock';
import { initialState, type AppState } from '../core/state';
import { createStore, type Store } from '../core/store';
import { registerClockCommands } from './clock';
import { createRegistry, type CommandRegistry } from './registry';
import { registerSceneCommands } from './scene';
import { registerThemeCommands } from './theme';

export interface AppContext {
  readonly store: Store<AppState>;
  readonly registry: CommandRegistry<AppState>;
  /**
   * The only source of time for animation. It is not part of `AppState`: a step every 10 ms
   * must not wake everyone who watches the store. Nothing moves it until someone feeds it time
   * (the real-time driver in `src/main.ts`, a test, the control channel).
   */
  readonly clock: Clock;
}

export interface AppOptions {
  /**
   * Called before every move of the clock by a command (`clock.set`, `clock.tick`).
   * `src/main.ts` stops the real-time driver here, so wall time never mixes into a scripted run.
   */
  readonly onManualClock?: (() => void) | undefined;
}

export function createApp(options: AppOptions = {}): AppContext {
  const store = createStore(initialState());
  const clock = createClock();
  const registry = createRegistry(() => store.get());
  // Every group of commands is registered here, one line per group.
  registerThemeCommands(registry, store);
  registerClockCommands(registry, clock, { onManual: options.onManualClock });
  registerSceneCommands(registry, store, clock);
  return { store, registry, clock };
}
