/**
 * A value that can be replaced and watched. No dependencies: the core does not know Svelte, but
 * `subscribe` follows the Svelte store contract, so a component may read it as `$store`.
 */
export interface Store<T> {
  get(): T;
  /** Replaces the value. Setting the very same value again notifies nobody. */
  set(next: T): void;
  /** Calls `listener` at once with the current value, then on every change. Returns "stop". */
  subscribe(listener: (value: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();

  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      // A copy: a listener may unsubscribe itself or another one while we go through the list.
      for (const listener of Array.from(listeners)) {
        if (listeners.has(listener)) listener(value);
      }
    },
    subscribe(listener) {
      // A fresh function per subscription, so the same listener may subscribe twice.
      const entry = (current: T) => {
        listener(current);
      };
      listeners.add(entry);
      listener(value);
      return () => {
        listeners.delete(entry);
      };
    },
  };
}
