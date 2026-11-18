// M1.2b: the loading deadline turns a hanging request into a result, and does not fire after
// the work is done.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withDeadline } from './load-timer';

describe('withDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives the work when it settles in time', async () => {
    const result = withDeadline(Promise.resolve('done'), 100, () => 'late');
    await expect(result).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives the timeout result when the work hangs', async () => {
    const result = withDeadline(new Promise<string>(() => undefined), 100, () => 'late');
    await vi.advanceTimersByTimeAsync(99);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('late');
  });

  it('keeps a rejection and clears the timer', async () => {
    const result = withDeadline(Promise.reject(new Error('boom')), 100, () => 'late');
    await expect(result).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });
});
