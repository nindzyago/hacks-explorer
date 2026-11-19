import type { AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/**
 * `locale.set` (M2.3, S5): the language of the page, one of the site languages. Only the language
 * changes: the lesson, its step, the defence mode, the depth and the speed stay. The language
 * switch in the top bar, the address and the control channel run it; a language the site does
 * not have is `invalid-params`.
 */
export function registerLocaleCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
  languages: readonly string[],
): void {
  registry.register({
    id: 'locale.set',
    titleKey: 'command.locale.set',
    params: { lang: { kind: 'enum', values: [...languages] } },
    run: ({ lang }) => {
      const state = store.get();
      if (state.locale !== lang) store.set(Object.freeze({ ...state, locale: lang }));
    },
  });
}
