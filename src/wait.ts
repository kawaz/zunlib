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
 * @returns Object with stop method
 *
 * @example
 * ```typescript
 * const { stop } = setPolling(() => {
 *   console.log("polling...");
 * }, { interval: 100, timeout: 5000, immediate: true });
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

type CondFn = () => boolean | Promise<boolean>;
type CondInput = CondFn | readonly CondFn[];

/**
 * Waits until condition function(s) return true
 *
 * Errors thrown or rejected promises from condition functions are silently
 * swallowed and treated as "not ready", retrying on the next interval.
 *
 * @param condFns - Single condition or array of conditions (all must be true)
 * @param options - Wait options
 * @returns Promise that resolves when all conditions are met
 *
 * @example
 * ```typescript
 * // Single condition
 * await waitCond(() => document.readyState === "complete");
 * await waitCond(() => someValue > 10, { timeout: 5000 });
 *
 * // Multiple conditions (all must be true)
 * await waitCond([() => isA(), () => isB(), () => isC()]);
 *
 * // Async condition
 * await waitCond(async () => await checkSomething());
 *
 * // With nothrow (resolves without rejecting on timeout/abort)
 * await waitCond(() => isReady, { nothrow: true });
 * ```
 */
export const waitCond = (
  condFns: CondInput,
  options: WaitOptions = {},
): Promise<void> => {
  const { interval = 100, timeout, signal, nothrow } = options;

  // Normalize to array
  const fns = typeof condFns === "function" ? [condFns] : condFns;

  // Check if all conditions are met (async, swallows errors as "not ready")
  const checkAll = async () => {
    try {
      const results = await Promise.all(fns.map((fn) => fn()));
      return results.every(Boolean);
    } catch {
      return false;
    }
  };

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
        if (await checkAll()) {
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

type MaybePromise<T> = T | Promise<T>;
type Getter<T> = () => MaybePromise<T | null | undefined>;
type GetterArray = readonly Getter<unknown>[];
type GetterRecord = Record<string, Getter<unknown>>;
type GetterInput = Getter<unknown> | GetterArray | GetterRecord;

type WaitValueResult<T> = T extends Getter<infer U>
  ? U
  : T extends readonly Getter<unknown>[]
    ? { [K in keyof T]: T[K] extends Getter<infer V> ? V : never }
    : T extends Record<string, Getter<unknown>>
      ? { [K in keyof T]: T[K] extends Getter<infer V> ? V : never }
      : never;

type WaitValueResultOrNull<T> = T extends Getter<infer U>
  ? U | null
  : T extends readonly Getter<unknown>[]
    ? { [K in keyof T]: T[K] extends Getter<infer V> ? V : never } | null
    : T extends Record<string, Getter<unknown>>
      ? { [K in keyof T]: T[K] extends Getter<infer V> ? V : never } | null
      : never;

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
export function waitValue<T extends GetterInput>(
  getters: T,
  options: WaitOptions & { nothrow: true },
): Promise<WaitValueResultOrNull<T>>;
export function waitValue<T extends GetterInput>(
  getters: T,
  options?: WaitOptions,
): Promise<WaitValueResult<T>>;
export function waitValue<T extends GetterInput>(
  getters: T,
  options: WaitOptions = {},
): Promise<WaitValueResult<T> | null> {
  const { interval = 100, timeout, signal, nothrow } = options;

  // Normalize to object form
  const isFunction = typeof getters === "function";
  const isArray = Array.isArray(getters);
  const normalized: GetterRecord = isFunction
    ? { result: getters }
    : isArray
      ? Object.fromEntries(getters.map((g, i) => [i, g]))
      : (getters as GetterRecord);
  const keys = Object.keys(normalized);

  // Get result extractor
  const getResult = (results: Record<string, unknown>) => {
    if (isFunction) return results.result as WaitValueResult<T>;
    if (isArray) return keys.map((k) => results[k]) as WaitValueResult<T>;
    return results as WaitValueResult<T>;
  };

  // Check if all values are ready (async, swallows errors as "not ready")
  const tryGetAll = async (): Promise<Record<string, unknown> | null> => {
    try {
      const results: Record<string, unknown> = {};
      for (const key of keys) {
        const value = await normalized[key]?.();
        if (value == null) return null;
        results[key] = value;
      }
      return results;
    } catch {
      return null;
    }
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
        const results = await tryGetAll();
        if (results) {
          stop();
          resolve(getResult(results));
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
