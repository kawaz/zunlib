import { toGetter, type ValueOrGetter } from "./valueOrGetter";

/**
 * A throttled function with additional methods
 *
 * @typeParam T - The original function type
 */
type ThrottledFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  interval: ValueOrGetter<number>;
  leading: ValueOrGetter<boolean>;
  trailing: ValueOrGetter<boolean>;
  cancel: () => void;
};

/**
 * Creates a throttled function that limits execution frequency
 *
 * The function will execute at most once per interval. By default,
 * executes immediately on first call (leading) and also executes
 * after the interval with the last arguments (trailing).
 *
 * @typeParam T - The function type to throttle
 * @param f - The function to throttle
 * @param opts - Options: interval in ms, function, or options object
 * @returns The throttled function with cancel method
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(handleScroll, 100)
 * window.addEventListener('scroll', throttledScroll)
 *
 * throttledScroll.interval = 200   // Change interval
 * throttledScroll.leading = false  // Disable leading execution
 * throttledScroll.trailing = false // Disable trailing execution
 * throttledScroll.cancel()         // Cancel pending execution
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  f: T,
  opts:
    | ValueOrGetter<number>
    | {
        interval: ValueOrGetter<number>;
        leading?: ValueOrGetter<boolean>;
        trailing?: ValueOrGetter<boolean>;
        signal?: AbortSignal;
      } = 100,
): ThrottledFunction<T> {
  opts = typeof opts === "object" ? opts : { interval: opts };
  const signal = opts?.signal;

  let interval = opts.interval;
  let intervalFn = toGetter(interval);

  let leading = opts.leading ?? true;
  let leadingFn = toGetter(leading);

  let trailing = opts.trailing ?? true;
  let trailingFn = toGetter(trailing);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  signal?.addEventListener("abort", cancel);

  const throttled = (...args: Parameters<T>) => {
    if (signal?.aborted) return;

    const now = Date.now();
    const elapsed = now - lastCallTime;
    const currentInterval = intervalFn();
    const shouldLead = leadingFn();
    const shouldTrail = trailingFn();

    if (elapsed >= currentInterval) {
      // 十分な時間が経過した
      if (shouldLead) {
        lastCallTime = now;
        f(...args);
      } else if (shouldTrail) {
        // leadingがfalseでtrailingがtrueの場合、引数を保存してタイマーセット
        lastArgs = args;
        lastCallTime = now;
        if (timeoutId === null) {
          timeoutId = setTimeout(() => {
            if (signal?.aborted) return;
            if (lastArgs !== null) {
              f(...lastArgs);
              lastArgs = null;
            }
            timeoutId = null;
          }, currentInterval);
        }
      }
    } else {
      // インターバル内の呼び出し
      if (shouldTrail) {
        lastArgs = args;
        if (timeoutId === null) {
          timeoutId = setTimeout(() => {
            if (signal?.aborted) return;
            if (lastArgs !== null) {
              lastCallTime = Date.now();
              f(...lastArgs);
              lastArgs = null;
            }
            timeoutId = null;
          }, currentInterval - elapsed);
        }
      }
    }
  };

  Object.defineProperty(throttled, "interval", {
    get: () => interval,
    set: (newInterval) => {
      interval = newInterval;
      intervalFn = toGetter(newInterval);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(throttled, "leading", {
    get: () => leading,
    set: (newLeading) => {
      leading = newLeading;
      leadingFn = toGetter(newLeading);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(throttled, "trailing", {
    get: () => trailing,
    set: (newTrailing) => {
      trailing = newTrailing;
      trailingFn = toGetter(newTrailing);
    },
    enumerable: true,
    configurable: true,
  });

  return Object.assign(throttled, {
    cancel,
  }) as ThrottledFunction<T>;
}
