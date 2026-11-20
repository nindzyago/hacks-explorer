/**
 * The application as the adapters see it: one state store, one player clock and one command
 * registry.
 * `src/main.ts` creates it once and hands it to the interface and to the control channel.
 */
import { createClock, type Clock } from '../core/clock';
import type { StepCounts } from '../core/player/player';
import { initialState, type AppState } from '../core/state';
import { createStore, type Store } from '../core/store';
import { registerClockCommands } from './clock';
import { registerDepthCommands } from './depth';
import { registerDrawerCommands } from './drawer';
import { registerGlossaryCommands } from './glossary';
import { registerLocaleCommands } from './locale';
import { registerPlayerCommands } from './player';
import { createRegistry, type CommandRegistry } from './registry';
import { registerThemeCommands } from './theme';
import { registerViewCommands } from './view';

export interface AppContext {
  readonly store: Store<AppState>;
  readonly registry: CommandRegistry<AppState>;
  /**
   * The only source of time for animation. It is not part of `AppState`: a step every 10 ms
   * must not wake everyone who watches the store. Nothing moves it until someone feeds it time
   * (the real-time driver in `src/main.ts`, a test, the control channel).
   */
  readonly clock: Clock;
  /**
   * The interface loaded lesson `id`: the player learns how many steps each mode has, so it can
   * stop at the end and keep step numbers inside the lesson. Ignored for a lesson not open.
   */
  lessonLoaded(id: string, counts: StepCounts): void;
  /** Whether the player needs the clock to run now: playing, or a message on its way. */
  timeNeeded(): boolean;
}

export interface AppOptions {
  /**
   * Called before every move of the clock by a command (`clock.set`, `clock.tick`).
   * `src/main.ts` stops the real-time driver here, so wall time never mixes into a scripted run.
   */
  readonly onManualClock?: (() => void) | undefined;
  /**
   * Called when `timeNeeded()` changes: `src/main.ts` starts or stops the real-time driver here
   * (K17: play and pause start and stop it; a message on its way keeps it running).
   */
  readonly onTimeNeeded?: ((needed: boolean) => void) | undefined;
  /**
   * The site languages (content/locales/languages.md, M2.3): the values `locale.set` accepts.
   * Russian alone when not given.
   */
  readonly languages?: readonly string[] | undefined;
  /** UI2: a lesson that opens starts playing by itself (see `PlayerCommandsOptions`). */
  readonly autoplay?: boolean | undefined;
  /** UI2: the reader asked for less motion: a lesson opens paused. */
  readonly reducedMotion?: (() => boolean) | undefined;
}

export function createApp(options: AppOptions = {}): AppContext {
  const store = createStore(initialState());
  const clock = createClock();
  const registry = createRegistry(() => store.get());
  // Every group of commands is registered here, one line per group.
  registerThemeCommands(registry, store);
  registerDepthCommands(registry, store);
  registerGlossaryCommands(registry, store);
  registerDrawerCommands(registry, store);
  registerViewCommands(registry, store);
  registerLocaleCommands(registry, store, options.languages ?? ['ru']);
  registerClockCommands(registry, clock, { onManual: options.onManualClock });
  const player = registerPlayerCommands(registry, store, clock, {
    onTimeNeeded: options.onTimeNeeded,
    autoplay: options.autoplay,
    reducedMotion: options.reducedMotion,
  });
  return {
    store,
    registry,
    clock,
    lessonLoaded: (id, counts) => {
      player.lessonLoaded(id, counts);
    },
    timeNeeded: () => player.timeNeeded(),
  };
}
