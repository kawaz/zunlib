import { type CondInputType, checkAll } from "./checkAll";
import {
  type Input,
  type InputArray,
  type InputRecord,
  type InputType,
  resolveAll,
} from "./resolveAll";

/**
 * Options for setSuperInterval
 */
type SuperIntervalOptions = {
  /** Interval in ms (default: 1000) */
  interval?: number;
  /** Timeout in ms (no timeout if not specified) */
  timeout?: number;
  /** Execute callback immediately before starting interval */
  immediate?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
};

/**
 * Creates an interval that continues running even when the tab is in background
 *
 * Uses Web Worker to avoid browser throttling of inactive tabs.
 * Falls back to standard setInterval if Worker is unavailable.
 *
 * @param callback - Function to call on each interval
 * @param options - Interval options
 * @returns Object with stop method
 *
 * @example
 * ```typescript
 * const { stop } = setSuperInterval(() => {
 *   console.log("tick");
 * }, { interval: 1000, immediate: true });
 *
 * // With AbortSignal
 * const controller = new AbortController();
 * setSuperInterval(() => console.log("tick"), {
 *   interval: 1000,
 *   signal: controller.signal,
 * });
 * controller.abort(); // stops the interval
 * ```
 */
export const setSuperInterval = (
  callback: () => void,
  options: SuperIntervalOptions = {},
): { stop: () => void } => {
  const { interval = 1000, timeout, immediate = false, signal } = options;

  let intervalId: ReturnType<typeof setInterval>;
  let worker: Worker | undefined;

  const stop = () => {
    clearInterval(intervalId);
    worker?.terminate();
  };

  try {
    const code = `self.addEventListener('message', msg=>{setInterval(()=>self.postMessage(null), msg.data)})`;
    worker = new Worker(`data:text/javascript;base64,${btoa(code)}`);
    worker.onmessage = () => {
      if (!signal?.aborted) callback();
    };
    worker.postMessage(interval);
  } catch {
    intervalId = setInterval(() => {
      if (!signal?.aborted) callback();
    }, interval);
  }

  signal?.addEventListener("abort", stop);
  if (timeout) setTimeout(stop, timeout);

  if (immediate && !signal?.aborted) {
    callback();
  }

  return { stop };
};

/**
 * Options for setPolling
 */
type PollingOptions = {
  /** Polling interval in ms (default: 100) */
  interval?: number;
  /** Timeout in ms (no timeout if not specified) */
  timeout?: number;
  /** Execute callback immediately before starting interval */
  immediate?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Callback when aborted by timeout, signal, or manual abort() call */
  onabort?: (reason: "timeout" | "signal" | "manual") => void;
};

/**
 * Runs a callback repeatedly until timeout or abort
 *
 * For background tab support, use setSuperInterval instead.
 *
 * @param callback - Function to call on each interval
 * @param options - Polling options
 * @returns Object with stop and abort methods
 *
 * @example
 * ```typescript
 * const { stop, abort } = setPolling(() => {
 *   console.log("polling...");
 * }, { interval: 100, timeout: 5000, immediate: true });
 *
 * stop();  // stops polling without calling onabort
 * abort(); // stops polling and calls onabort with "manual"
 * ```
 */
export const setPolling = (
  callback: () => void,
  options: PollingOptions = {},
): { stop: () => void; abort: () => void } => {
  const {
    interval = 100,
    timeout,
    immediate = false,
    signal,
    onabort,
  } = options;

  if (signal?.aborted) {
    onabort?.("signal");
    return { stop: () => {}, abort: () => {} };
  }

  let stopped = false;
  const intervalId = setInterval(callback, interval);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
  };

  const abort = () => {
    if (stopped) return;
    stop();
    onabort?.("manual");
  };

  signal?.addEventListener("abort", () => {
    if (stopped) return;
    stop();
    onabort?.("signal");
  });
  if (timeout) {
    setTimeout(() => {
      if (stopped) return;
      stop();
      onabort?.("timeout");
    }, timeout);
  }
  if (immediate) callback();

  return { stop, abort };
};

/**
 * Options for wait functions
 */
type WaitOptions = {
  /** Polling interval in ms (default: 100) */
  interval?: number;
  /** Timeout in ms (no timeout if not specified) */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Return value instead of rejecting on timeout/abort */
  nothrow?: boolean;
};

/**
 * Waits until condition function(s) return true
 *
 * Errors thrown or rejected promises from condition functions are silently
 * swallowed and treated as "not ready", retrying on the next interval.
 *
 * @param condFns - Single condition, array of conditions, or object of conditions (all must be true)
 * @param options - Wait options
 * @returns Promise that resolves when all conditions are met
 *
 * @example
 * ```typescript
 * // Single condition
 * await waitCond(() => document.readyState === "complete");
 * await waitCond(() => someValue > 10, { timeout: 5000 });
 *
 * // Array of conditions (all must be true)
 * await waitCond([() => isA(), () => isB(), () => isC()]);
 *
 * // Object of conditions
 * await waitCond({
 *   auth: () => isAuthenticated(),
 *   ready: () => isReady(),
 * });
 *
 * // Async condition
 * await waitCond(async () => await checkSomething());
 *
 * // With nothrow (resolves without rejecting on timeout/abort)
 * await waitCond(() => isReady, { nothrow: true });
 * ```
 */
export const waitCond = (
  condFns: CondInputType,
  options: WaitOptions = {},
): Promise<void> => {
  const { interval = 100, timeout, signal, nothrow } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      if (nothrow) {
        resolve();
      } else {
        reject("signal");
      }
      return;
    }

    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        // checkAll with nothrow swallows errors and returns false
        if (await checkAll(condFns, { nothrow: true })) {
          stop();
          resolve();
        }
      } finally {
        checking = false;
      }
    };

    // Initial check
    check();

    const { stop } = setPolling(check, {
      interval,
      timeout,
      signal,
      onabort: nothrow ? () => resolve() : reject,
    });
  });
};

type WaitValueResult<T> = T extends Input<infer U>
  ? NonNullable<U>
  : T extends readonly Input<unknown>[]
    ? { [K in keyof T]: T[K] extends Input<infer V> ? NonNullable<V> : never }
    : T extends Record<string, Input<unknown>>
      ? {
          [K in keyof T]: T[K] extends Input<infer V> ? NonNullable<V> : never;
        }
      : never;

type WaitValueResultOrNull<T> = WaitValueResult<T> | null;

/**
 * Waits until getter(s) return non-null/undefined value(s)
 *
 * Errors thrown or rejected promises from getters are silently swallowed
 * and treated as "not ready", retrying on the next interval.
 *
 * @param getters - Single getter, array of getters, or object of getters
 * @param options - Wait options with optional nothrow
 * @returns Promise that resolves with the value(s)
 *
 * @example
 * ```typescript
 * // Single getter
 * const el = await waitValue(() => document.querySelector("div"));
 *
 * // Array of getters
 * const [a, b] = await waitValue([() => getA(), () => getB()]);
 *
 * // Object of getters
 * const { foo, bar } = await waitValue({
 *   foo: () => getFoo(),
 *   bar: () => getBar(),
 * });
 *
 * // Async getter
 * const data = await waitValue(async () => await fetchData());
 *
 * // With nothrow (returns null instead of rejecting)
 * const el = await waitValue(() => el, { nothrow: true });
 * ```
 */
export function waitValue<T extends InputType>(
  getters: T,
  options: WaitOptions & { nothrow: true },
): Promise<WaitValueResultOrNull<T>>;
export function waitValue<T extends InputType>(
  getters: T,
  options?: WaitOptions,
): Promise<WaitValueResult<T>>;
export function waitValue<T extends InputType>(
  getters: T,
  options: WaitOptions = {},
): Promise<WaitValueResult<T> | null> {
  const { interval = 100, timeout, signal, nothrow } = options;

  // Normalize to object form for resolveAll
  const isFunction =
    typeof getters === "function" || getters instanceof Promise;
  const isArray = Array.isArray(getters);
  const normalized: InputRecord = isFunction
    ? { result: getters as Input<unknown> }
    : isArray
      ? Object.fromEntries((getters as InputArray).map((g, i) => [i, g]))
      : (getters as InputRecord);
  const keys = Object.keys(normalized);

  // Build result in original shape
  const buildResult = (
    results: Record<string, unknown>,
  ): WaitValueResult<T> => {
    if (isFunction) return results.result as WaitValueResult<T>;
    if (isArray)
      return keys.map((k) => results[k]) as unknown as WaitValueResult<T>;
    return results as WaitValueResult<T>;
  };

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      if (nothrow) {
        resolve(null);
      } else {
        reject("signal");
      }
      return;
    }

    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        // resolveAll with nothrow swallows errors and returns null
        const results = await resolveAll(normalized, { nothrow: true });
        if (results === null) return;
        // Check all values are non-null/undefined
        const values = Object.values(results);
        if (values.every((v) => v != null)) {
          stop();
          resolve(buildResult(results));
        }
      } finally {
        checking = false;
      }
    };

    // Initial check
    check();

    const { stop } = setPolling(check, {
      interval,
      timeout,
      signal,
      onabort: nothrow ? () => resolve(null) : reject,
    });
  });
}
