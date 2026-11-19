import { DRAWER_TABS, type AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/**
 * `drawer.open` and `drawer.close` (M2.1b, E2): the side panel with the lessons by section and
 * the glossary. The «Уроки» and «Словарь» buttons, Esc, a click outside, the control channel and
 * the tests all run these. Opening or closing the panel, or switching its tab, closes a glossary
 * term that was open: inside the panel a term shows on the glossary tab, outside it in place.
 */
export function registerDrawerCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
): void {
  registry.register({
    id: 'drawer.open',
    titleKey: 'command.drawer.open',
    params: { tab: { kind: 'enum', values: DRAWER_TABS, optional: true } },
    run: ({ tab }) => {
      const state = store.get();
      const next = tab ?? 'lessons';
      if (state.drawer === next && state.glossary === null) return;
      store.set(Object.freeze({ ...state, drawer: next, glossary: null }));
    },
  });
  registry.register({
    id: 'drawer.close',
    titleKey: 'command.drawer.close',
    params: {},
    run: () => {
      const state = store.get();
      // Closed already: a definition open in place is not the panel's to close.
      if (state.drawer === null) return;
      store.set(Object.freeze({ ...state, drawer: null, glossary: null }));
    },
  });
}
