/**
 * Input type that accepts getter functions or Promises
 */
export type MaybePromise<T> = T | Promise<T>;
export type Input<T> = (() => MaybePromise<T>) | Promise<T>;

export type InputArray = readonly Input<unknown>[];
export type InputRecord = Record<string, Input<unknown>>;
export type InputType = Input<unknown> | InputArray | InputRecord;

/**
 * Extract the resolved type from an Input
 */
type ResolvedInput<T> = T extends Input<infer U> ? U : never;

/**
 * Result type based on input shape
 */
type ResolveResult<T> = T extends Input<infer U>
  ? U
  : T extends readonly Input<unknown>[]
    ? { [K in keyof T]: ResolvedInput<T[K]> }
    : T extends Record<string, Input<unknown>>
      ? { [K in keyof T]: ResolvedInput<T[K]> }
      : never;

/**
 * PromiseSettledResult with typed value
 */
type SettledResult<T> = T extends Input<infer U>
  ? PromiseSettledResult<U>
  : never;

/**
 * Settled result type based on input shape
 */
type SettledResults<T> = T extends Input<infer U>
  ? PromiseSettledResult<U>
  : T extends readonly Input<unknown>[]
    ? { [K in keyof T]: SettledResult<T[K]> }
    : T extends Record<string, Input<unknown>>
      ? { [K in keyof T]: SettledResult<T[K]> }
      : never;

/**
 * Options for resolveAll
 */
interface ResolveAllOptions {
  /**
   * If true, waits for all inputs like Promise.allSettled.
   * On failure, rejects with settled results object instead of first error.
   * @default false
   */
  settled?: boolean;
  /**
   * If true, returns null instead of rejecting on failure
   * @default false
   */
  nothrow?: boolean;
}

// Overloads for single input
export function resolveAll<T>(
  input: Input<T>,
  options?: { settled?: boolean; nothrow?: false },
): Promise<T>;
export function resolveAll<T>(
  input: Input<T>,
  options: { settled?: boolean; nothrow: true },
): Promise<T | null>;

// Overloads for array input
export function resolveAll<T extends InputArray>(
  inputs: T,
  options?: { settled?: boolean; nothrow?: false },
): Promise<{ [K in keyof T]: ResolvedInput<T[K]> }>;
export function resolveAll<T extends InputArray>(
  inputs: T,
  options: { settled?: boolean; nothrow: true },
): Promise<{ [K in keyof T]: ResolvedInput<T[K]> } | null>;

// Overloads for object input
export function resolveAll<T extends InputRecord>(
  inputs: T,
  options?: { settled?: boolean; nothrow?: false },
): Promise<{ [K in keyof T]: ResolvedInput<T[K]> }>;
export function resolveAll<T extends InputRecord>(
  inputs: T,
  options: { settled?: boolean; nothrow: true },
): Promise<{ [K in keyof T]: ResolvedInput<T[K]> } | null>;

// Overloads for union type (for internal use like waitValue)
export function resolveAll(
  inputs: InputType,
  options?: { settled?: boolean; nothrow?: false },
): Promise<unknown>;
export function resolveAll(
  inputs: InputType,
  options: { settled?: boolean; nothrow: true },
): Promise<unknown | null>;

/**
 * Resolves multiple inputs (getters or Promises) simultaneously
 *
 * @param inputs - Single input, array of inputs, or object of inputs
 * @param options - Resolution options
 * @returns Promise that resolves with the values in the same shape as input
 *
 * @example
 * ```typescript
 * // Single input
 * const value = await resolveAll(() => getValue());
 * const value2 = await resolveAll(fetchData());
 *
 * // Array input (use as const for tuple types)
 * const [a, b] = await resolveAll([() => getA(), fetchB()] as const);
 *
 * // Object input
 * const { foo, bar } = await resolveAll({
 *   foo: () => getFoo(),
 *   bar: fetchBar(),
 * });
 *
 * // With settled - on failure, rejects with settled results
 * try {
 *   const result = await resolveAll({ a: fetchA(), b: failingB() }, { settled: true });
 * } catch (e) {
 *   // e: { a: { status: 'fulfilled', value: 'A' }, b: { status: 'rejected', reason: Error } }
 * }
 *
 * // With nothrow - returns null on failure
 * const result = await resolveAll({ a: fetchA(), b: failingB() }, { nothrow: true });
 * if (result === null) {
 *   // handle failure
 * }
 * ```
 */
export function resolveAll<T extends InputType>(
  inputs: T,
  options: ResolveAllOptions = {},
): Promise<ResolveResult<T> | null> {
  const { settled = false, nothrow = false } = options;

  // Normalize input to object form
  const isFunction = typeof inputs === "function" || inputs instanceof Promise;
  const isArray = Array.isArray(inputs);
  const normalized: InputRecord = isFunction
    ? { result: inputs as Input<unknown> }
    : isArray
      ? Object.fromEntries((inputs as InputArray).map((input, i) => [i, input]))
      : (inputs as InputRecord);

  const keys = Object.keys(normalized);

  // Convert input to Promise
  const toPromise = (input: Input<unknown>): Promise<unknown> => {
    if (input instanceof Promise) return input;
    return Promise.resolve().then(() => input());
  };

  // Build result from resolved values
  const buildResult = (values: Record<string, unknown>): ResolveResult<T> => {
    if (isFunction) return values.result as ResolveResult<T>;
    if (isArray) return keys.map((k) => values[k]) as ResolveResult<T>;
    return values as ResolveResult<T>;
  };

  // Build settled results
  const buildSettledResults = (
    results: Record<string, PromiseSettledResult<unknown>>,
  ): SettledResults<T> => {
    if (isFunction) return results.result as SettledResults<T>;
    if (isArray)
      return keys.map((k) => results[k]) as unknown as SettledResults<T>;
    return results as SettledResults<T>;
  };

  if (!settled) {
    // Promise.all mode - reject with first error
    return Promise.all(keys.map((k) => toPromise(normalized[k]!)))
      .then((values) => {
        const result: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) {
          result[keys[i]!] = values[i];
        }
        return buildResult(result);
      })
      .catch((error) => {
        if (nothrow) return null;
        throw error;
      });
  }

  // allSettled mode - wait for all, reject with settled results if any failed
  return Promise.allSettled(keys.map((k) => toPromise(normalized[k]!))).then(
    (settledResults) => {
      const results: Record<string, PromiseSettledResult<unknown>> = {};
      const values: Record<string, unknown> = {};
      let hasError = false;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        const settledItem = settledResults[i]!;
        results[key] = settledItem;
        if (settledItem.status === "fulfilled") {
          values[key] = settledItem.value;
        } else {
          hasError = true;
        }
      }

      if (hasError) {
        if (nothrow) return null;
        throw buildSettledResults(results);
      }

      return buildResult(values);
    },
  );
}
