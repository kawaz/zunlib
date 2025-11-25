/**
 * A throttled function with interval property
 *
 * @typeParam T - The original function type
 */
type ThrottledFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  interval: number;
};

/**
 * Creates a throttled function that limits execution frequency
 *
 * The function will execute at most once per interval.
 * Calls within the interval are ignored.
 *
 * @typeParam T - The function type to throttle
 * @param f - The function to throttle
 * @param interval - Minimum interval between executions in ms (default: 100)
 * @returns The throttled function with interval property
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(handleScroll, 100)
 * window.addEventListener('scroll', throttledScroll)
 *
 * throttledScroll.interval = 200 // Change interval at runtime
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  f: T,
  interval: number = 100,
): ThrottledFunction<T> {
  let lastCallTime = 0;
  const throttled: ThrottledFunction<T> = Object.assign(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCallTime < throttled.interval) {
        return;
      }
      lastCallTime = now;
      f(...args);
    },
    { interval },
  );
  return throttled;
}
