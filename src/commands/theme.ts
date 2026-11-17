import { THEMES, type AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/** `theme.set`: the first real command. Remembering the choice between visits is M2.6. */
export function registerThemeCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
): void {
  registry.register({
    id: 'theme.set',
    titleKey: 'command.theme.set',
    params: { theme: { kind: 'enum', values: THEMES } },
    run: ({ theme }) => {
      const state = store.get();
      if (state.theme !== theme) store.set(Object.freeze({ ...state, theme }));
    },
  });
}
