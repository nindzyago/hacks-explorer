/**
 * Temporary scene commands (design M1.2 E10): `scene.step` and `scene.defence` choose what the
 * scene shows until the player (M1.3) replaces them with `player.*` and `defence.toggle`;
 * `lesson.open` switches the lesson on the one page of M1. Each starts the step at the time of
 * the player clock, so the message travels from there (E2).
 */
import type { Clock } from '../core/clock';
import { MAX_STEP, sceneState, type AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/** A lesson id: a section letter and a number (B1, I1, K12). */
const LESSON_ID = /^[A-Z]\d{1,3}$/;

export function registerSceneCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
  clock: Pick<Clock, 'now'>,
): void {
  const update = (change: (state: AppState) => Partial<AppState>) => {
    const state = store.get();
    store.set(Object.freeze({ ...state, ...change(state) }));
  };
  registry.register({
    id: 'scene.step',
    titleKey: 'command.scene.step',
    params: { step: { kind: 'integer', min: 1, max: MAX_STEP } },
    run: ({ step }) => {
      update((s) => ({ scene: sceneState(step, s.scene.defence, clock.now()) }));
    },
  });
  registry.register({
    id: 'scene.defence',
    titleKey: 'command.scene.defence',
    params: { on: { kind: 'boolean' } },
    run: ({ on }) => {
      update((s) => ({ scene: sceneState(s.scene.step, on, clock.now()) }));
    },
  });
  registry.register({
    id: 'lesson.open',
    titleKey: 'command.lesson.open',
    params: { id: { kind: 'string', maxLength: 32 } },
    run: ({ id }) => {
      if (!LESSON_ID.test(id)) throw new Error('a lesson id looks like B1');
      update(() => ({ lesson: id, scene: sceneState(1, false, clock.now()) }));
    },
  });
}
