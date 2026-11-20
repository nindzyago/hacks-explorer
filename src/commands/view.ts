import { VIEWS, type AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/**
 * `view.set` (M6.2, design M6 §5): how the lesson is drawn, `scene` or `sequence`. The tabs, the
 * control channel and the tests all run it; anything else is `invalid-params`. It touches
 * nothing else: the step, the defence mode, the depth and the address stay.
 */
export function registerViewCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
): void {
  registry.register({
    id: 'view.set',
    titleKey: 'command.view.set',
    params: { view: { kind: 'enum', values: VIEWS } },
    run: ({ view }) => {
      const state = store.get();
      if (state.view !== view) store.set(Object.freeze({ ...state, view }));
    },
  });
}
