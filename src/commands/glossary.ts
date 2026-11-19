import type { AppState } from '../core/state';
import type { Store } from '../core/store';
import type { CommandRegistry } from './registry';

/** A glossary term id, as the checker writes them (src/core/glossary). */
const TERM_ID = '[a-z][a-z0-9-]{0,31}';

/**
 * `glossary.open` and `glossary.close` (M2.4, K7): the definition of a term opens in place, one
 * at a time; opening another replaces it. A term in lesson text, an icon or a zone on the scene,
 * «см. также» in the definition, the control channel and the tests all run these. Whether the id
 * is in the glossary is the popover's business: it says so when it is not.
 */
export function registerGlossaryCommands(
  registry: CommandRegistry<AppState>,
  store: Store<AppState>,
): void {
  registry.register({
    id: 'glossary.open',
    titleKey: 'command.glossary.open',
    params: { id: { kind: 'string', maxLength: 32, pattern: TERM_ID } },
    run: ({ id }) => {
      const state = store.get();
      if (state.glossary !== id) store.set(Object.freeze({ ...state, glossary: id }));
    },
  });
  registry.register({
    id: 'glossary.close',
    titleKey: 'command.glossary.close',
    params: {},
    run: () => {
      const state = store.get();
      if (state.glossary !== null) store.set(Object.freeze({ ...state, glossary: null }));
    },
  });
}
