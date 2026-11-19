/**
 * Player commands (architecture §3, M1.3): `player.play`, `player.pause`, `player.step`,
 * `player.back`, `player.goto`, `player.speed`, `defence.toggle`, `defence.set`, and
 * `lesson.open` for the one page of M1. They replace the temporary `scene.step` and
 * `scene.defence` of M1.2 (K68). The rules live in the pure model src/core/player; here they meet
 * the store and the player clock. Autoplay is a subscriber of the clock: no timers (K17).
 */
import type { Clock } from '../core/clock';
import {
  advance,
  back,
  goto,
  initialPlayer,
  isSpeed,
  MAX_STEPS,
  needsTime,
  pause,
  play,
  setDefence,
  setSpeed,
  SPEEDS,
  stepCount,
  stepForward,
  withCounts,
  type PlayerState,
  type StepCounts,
} from '../core/player/player';
import type { AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/** A lesson id: a section letter and a number (B1, I1, K12); checked as a parameter. */
const LESSON_ID = '[A-Z][0-9]{1,3}';

export interface PlayerCommandsOptions {
  /**
   * Called when the player starts or stops needing the clock to run: while playing, or while the
   * message of the step is on its way. `src/main.ts` starts and stops the real-time driver here.
   */
  readonly onTimeNeeded?: ((needed: boolean) => void) | undefined;
}

export interface PlayerHandle {
  /** The interface tells the player how many steps the lesson it loaded has (per mode). */
  lessonLoaded(id: string, counts: StepCounts): void;
  /** Whether the clock has to run now (see `onTimeNeeded`). */
  timeNeeded(): boolean;
}

export function registerPlayerCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
  clock: Pick<Clock, 'now' | 'subscribe'>,
  options: PlayerCommandsOptions = {},
): PlayerHandle {
  const { onTimeNeeded } = options;
  let needed = needsTime(store.get().player, clock.now());

  /** Tells the driver when the need for time changed. */
  function check(): void {
    const now = needsTime(store.get().player, clock.now());
    if (now === needed) return;
    needed = now;
    onTimeNeeded?.(now);
  }

  function change(next: (player: PlayerState, nowMs: number) => PlayerState): void {
    const state = store.get();
    const player = next(state.player, clock.now());
    if (player !== state.player) store.set(Object.freeze({ ...state, player }));
    check();
  }

  // Autoplay: every step of the clock may finish a step of the lesson.
  clock.subscribe((event) => {
    change((player) => advance(player, event.timeMs));
  });

  registry.register({
    id: 'player.play',
    titleKey: 'command.player.play',
    params: {},
    // No steps (no lesson shown, a failed load): nothing to play, and the clock must not run.
    enabled: (state) => stepCount(state.player) > 0,
    run: () => {
      change(play);
    },
  });
  registry.register({
    id: 'player.pause',
    titleKey: 'command.player.pause',
    params: {},
    run: () => {
      change(pause);
    },
  });
  registry.register({
    id: 'player.step',
    titleKey: 'command.player.step',
    params: {},
    run: () => {
      change(stepForward);
    },
  });
  registry.register({
    id: 'player.back',
    titleKey: 'command.player.back',
    params: {},
    run: () => {
      change(back);
    },
  });
  registry.register({
    id: 'player.goto',
    titleKey: 'command.player.goto',
    params: { step: { kind: 'integer', min: 1, max: MAX_STEPS } },
    run: ({ step }) => {
      change((player, now) => goto(player, step, now));
    },
  });
  registry.register({
    id: 'player.speed',
    titleKey: 'command.player.speed',
    params: { value: { kind: 'number', values: SPEEDS } },
    run: ({ value }) => {
      // The registry already allowed only SPEEDS; the check narrows the type.
      if (isSpeed(value)) change((player, now) => setSpeed(player, value, now));
    },
  });
  registry.register({
    id: 'defence.toggle',
    titleKey: 'command.defence.toggle',
    params: {},
    run: () => {
      change((player, now) => setDefence(player, !player.defence, now));
    },
  });
  registry.register({
    id: 'defence.set',
    titleKey: 'command.defence.set',
    params: { on: { kind: 'boolean' } },
    run: ({ on }) => {
      change((player, now) => setDefence(player, on, now));
    },
  });
  registry.register({
    id: 'lesson.open',
    titleKey: 'command.lesson.open',
    params: { id: { kind: 'string', maxLength: 32, pattern: LESSON_ID } },
    run: ({ id }) => {
      const state = store.get();
      // The same lesson again keeps its step counts: the page does not load it again.
      const counts = id === state.lesson ? state.player.counts : initialPlayer().counts;
      const fresh = {
        ...initialPlayer(),
        speed: state.player.speed,
        startedMs: clock.now(),
        counts,
      };
      // M2.1b (K113): any change of lesson (the panel, Back and Forward, the control channel)
      // closes the side panel and a term open in it.
      const panel = state.drawer === null ? {} : { drawer: null, glossary: null };
      store.set(Object.freeze({ ...state, ...panel, lesson: id, player: Object.freeze(fresh) }));
      check();
    },
  });

  return {
    lessonLoaded(id, counts) {
      if (store.get().lesson !== id) return;
      change((player) => withCounts(player, counts));
    },
    timeNeeded: () => needed,
  };
}
