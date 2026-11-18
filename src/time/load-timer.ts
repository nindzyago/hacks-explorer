/**
 * A deadline for loading lesson data (M1.2b): a slow or hanging server becomes an error message
 * with a retry instead of an endless «Загружаем урок…» (L0.1). This is wall time on purpose —
 * a network deadline, not animation — so it is the second file the timing rules let use a timer
 * (scripts/timing-rules.mjs). Nothing on the scene depends on it.
 */

/** How long the page waits for a lesson before it says so. */
export const LOAD_TIMEOUT_MS = 15_000;

/**
 * `work`, or `onTimeout()` when `work` has not settled after `ms`. The timer is cleared when
 * `work` settles first. A rejected `work` stays rejected.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(onTimeout());
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('load failed'));
      },
    );
  });
}
