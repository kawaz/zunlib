import { toGetter, type ValueOrGetter } from "./valueOrGetter";

/**
 * A debounced function with additional methods
 *
 * @typeParam T - The original function type
 */
type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  delay: ValueOrGetter<number>;
  cancel: () => void;
  flush: () => void;
};

/**
 * Creates a debounced function that delays execution
 *
 * The function will only execute once after the specified delay has elapsed
 * since the last call. Useful for events like keyboard input or window resize.
 *
 * @typeParam T - The function type to debounce
 * @param f - The function to debounce
 * @param opts - Options: delay in ms, function, or options object
 * @returns The debounced function with cancel and flush methods
 *
 * @example
 * ```typescript
 * const debouncedLog = debounce(console.log, 1000)
 * debouncedLog("test") // Executes after 1 second
 *
 * debouncedLog.delay = 500  // Change delay
 * debouncedLog.cancel()     // Cancel pending execution
 * debouncedLog.flush()      // Execute immediately
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  f: T,
  opts:
    | ValueOrGetter<number>
    | {
        delay: ValueOrGetter<number>;
        signal?: AbortSignal;
      } = 100,
): DebouncedFunction<T> {
  opts = typeof opts === "object" ? opts : { delay: opts };
  const signal = opts?.signal;
  let delay = opts.delay;
  let delayFn = toGetter(delay);
  let timeoutId: ReturnType<typeof setTimeout>;
  let pending = () => {};
  const cancel = () => clearTimeout(timeoutId);
  const flush = () => {
    cancel();
    pending();
  };
  signal?.addEventListener("abort", cancel);
  const debounced = (...args: Parameters<T>) => {
    cancel();
    if (signal?.aborted) return;
    pending = () => {
      if (signal?.aborted) return;
      f(...args);
    };
    timeoutId = setTimeout(pending, delayFn());
  };
  Object.defineProperty(debounced, "delay", {
    get: () => delay,
    set: (newDelay) => {
      delay = newDelay;
      delayFn = toGetter(newDelay);
    },
    enumerable: true,
    configurable: true,
  });
  return Object.assign(debounced, {
    cancel,
    flush,
  }) as DebouncedFunction<T>;
}
