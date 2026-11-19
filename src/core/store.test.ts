import { describe, expect, it } from 'vitest';
import { initialState } from './state';
import { createStore } from './store';

describe('createStore', () => {
  it('holds a value and replaces it', () => {
    const store = createStore({ n: 1 });
    expect(store.get()).toEqual({ n: 1 });
    store.set({ n: 2 });
    expect(store.get()).toEqual({ n: 2 });
  });

  it('calls a subscriber at once and on every change, until it unsubscribes', () => {
    const store = createStore(1);
    const seen: number[] = [];
    const unsubscribe = store.subscribe((value) => seen.push(value));
    store.set(2);
    unsubscribe();
    unsubscribe();
    store.set(3);
    expect(seen).toEqual([1, 2]);
  });

  it('does not notify when the same value is set again', () => {
    const value = { n: 1 };
    const store = createStore(value);
    let calls = 0;
    store.subscribe(() => (calls += 1));
    store.set(value);
    expect(calls).toBe(1);
  });

  it('lets a subscriber unsubscribe another one during a change', () => {
    const store = createStore(0);
    const seen: string[] = [];
    const stops: (() => void)[] = [];
    stops.push(
      store.subscribe(() => {
        seen.push('a');
        stops[1]?.();
      }),
    );
    stops.push(store.subscribe(() => seen.push('b')));
    store.set(1);
    store.set(2);
    expect(seen).toEqual(['a', 'b', 'a', 'a']);
  });
});

describe('initialState', () => {
  it('is frozen plain data that survives JSON', () => {
    const state = initialState();
    expect(state).toEqual({
      theme: 'light',
      lesson: 'I1',
      player: {
        step: 1,
        defence: false,
        startedMs: 0,
        playing: false,
        speed: 1,
        counts: { without: 0, with: 0 },
      },
      depth: 'simple',
      glossary: null,
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(initialState()).not.toBe(initialState());
  });
});
