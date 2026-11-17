/**
 * The application as the adapters see it: one state store and one command registry.
 * `src/main.ts` creates it once and hands it to the interface and to the control channel.
 */
import { initialState, type AppState } from '../core/state';
import { createStore, type Store } from '../core/store';
import { createRegistry, type CommandRegistry } from './registry';
import { registerThemeCommands } from './theme';

export interface AppContext {
  readonly store: Store<AppState>;
  readonly registry: CommandRegistry<AppState>;
}

export function createApp(): AppContext {
  const store = createStore(initialState());
  const registry = createRegistry(() => store.get());
  // Every group of commands is registered here, one line per group.
  registerThemeCommands(registry, store);
  return { store, registry };
}
