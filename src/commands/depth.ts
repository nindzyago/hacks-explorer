import { DEPTHS, type AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/**
 * `depth.set` (M1.4, S3): the depth of the explanation, `simple`, `steps` or `deep`. The tabs of
 * the panel, the control channel and the tests all run it; anything else is `invalid-params`.
 */
export function registerDepthCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
): void {
  registry.register({
    id: 'depth.set',
    titleKey: 'command.depth.set',
    params: { depth: { kind: 'enum', values: DEPTHS } },
    run: ({ depth }) => {
      const state = store.get();
      if (state.depth !== depth) store.set(Object.freeze({ ...state, depth }));
    },
  });
}
