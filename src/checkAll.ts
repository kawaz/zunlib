import type { MaybePromise } from "./resolveAll";

/**
 * Input type that accepts condition functions or Promises
 */
export type CondInput = (() => MaybePromise<boolean>) | Promise<boolean>;

export type CondInputArray = readonly CondInput[];
export type CondInputRecord = Record<string, CondInput>;
export type CondInputType = CondInput | CondInputArray | CondInputRecord;

/**
 * Settled result type based on input shape
 */
type SettledResults<T> = T extends CondInput
  ? PromiseSettledResult<boolean>
  : T extends readonly CondInput[]
    ? { [K in keyof T]: PromiseSettledResult<boolean> }
    : T extends Record<string, CondInput>
      ? { [K in keyof T]: PromiseSettledResult<boolean> }
      : never;

/**
 * Options for checkAll
 */
interface CheckAllOptions {
  /**
   * If true, waits for all inputs like Promise.allSettled.
   * On failure, rejects with settled results object instead of first error.
   * @default false
   */
  settled?: boolean;
  /**
   * If true, returns false instead of rejecting on failure
   * @default false
   */
  nothrow?: boolean;
}

// Overloads for single input
export function checkAll(
  input: CondInput,
  options?: { settled?: boolean; nothrow?: false },
): Promise<true>;
export function checkAll(
  input: CondInput,
  options: { settled?: boolean; nothrow: true },
): Promise<boolean>;

// Overloads for array input
export function checkAll<T extends CondInputArray>(
  inputs: T,
  options?: { settled?: boolean; nothrow?: false },
): Promise<true>;
export function checkAll<T extends CondInputArray>(
  inputs: T,
  options: { settled?: boolean; nothrow: true },
): Promise<boolean>;

// Overloads for object input
export function checkAll<T extends CondInputRecord>(
  inputs: T,
  options?: { settled?: boolean; nothrow?: false },
): Promise<true>;
export function checkAll<T extends CondInputRecord>(
  inputs: T,
  options: { settled?: boolean; nothrow: true },
): Promise<boolean>;

// Overloads for union type (for internal use like waitCond)
export function checkAll(
  inputs: CondInputType,
  options?: { settled?: boolean; nothrow?: false },
): Promise<true>;
export function checkAll(
  inputs: CondInputType,
  options: { settled?: boolean; nothrow: true },
): Promise<boolean>;

/**
 * Checks multiple conditions simultaneously
 *
 * @param inputs - Single condition, array of conditions, or object of conditions
 * @param options - Check options
 * @returns Promise that resolves with true if all conditions pass
 *
 * @example
 * ```typescript
 * // Single condition
 * await checkAll(() => isValid());
 * await checkAll(validateAsync());
 *
 * // Array input
 * await checkAll([() => checkA(), () => checkB()]);
 *
 * // Object input
 * await checkAll({
 *   auth: () => isAuthenticated(),
 *   permission: checkPermission(),
 * });
 *
 * // With settled - on failure, rejects with settled results
 * try {
 *   await checkAll({ a: checkA(), b: checkB() }, { settled: true });
 * } catch (e) {
 *   // e: { a: { status: 'fulfilled', value: true }, b: { status: 'fulfilled', value: false } }
 * }
 *
 * // With nothrow - returns false on failure
 * const ok = await checkAll({ a: checkA(), b: checkB() }, { nothrow: true });
 * if (!ok) {
 *   // handle failure
 * }
 * ```
 */
export function checkAll<T extends CondInputType>(
  inputs: T,
  options: CheckAllOptions = {},
): Promise<true | boolean> {
  const { settled = false, nothrow = false } = options;

  // Normalize input to object form
  const isFunction = typeof inputs === "function" || inputs instanceof Promise;
  const isArray = Array.isArray(inputs);
  const normalized: CondInputRecord = isFunction
    ? { result: inputs as CondInput }
    : isArray
      ? Object.fromEntries(
          (inputs as CondInputArray).map((input, i) => [i, input]),
        )
      : (inputs as CondInputRecord);

  const keys = Object.keys(normalized);

  // Convert input to Promise
  const toPromise = (input: CondInput): Promise<boolean> => {
    if (input instanceof Promise) return input;
    return Promise.resolve().then(() => input());
  };

  // Build settled results
  const buildSettledResults = (
    results: Record<string, PromiseSettledResult<boolean>>,
  ): SettledResults<T> => {
    if (isFunction) return results.result as SettledResults<T>;
    if (isArray)
      return keys.map((k) => results[k]) as unknown as SettledResults<T>;
    return results as SettledResults<T>;
  };

  if (!settled) {
    // Promise.all mode - reject with first error or false
    return Promise.all(keys.map((k) => toPromise(normalized[k]!)))
      .then((values) => {
        const falseIndex = values.indexOf(false);
        if (falseIndex !== -1) {
          if (nothrow) return false;
          throw new Error(`Condition "${keys[falseIndex]}" returned false`);
        }
        return true as const;
      })
      .catch((error) => {
        if (nothrow) return false;
        throw error;
      });
  }

  // allSettled mode - wait for all, reject with settled results if any failed
  return Promise.allSettled(keys.map((k) => toPromise(normalized[k]!))).then(
    (settledResults) => {
      const results: Record<string, PromiseSettledResult<boolean>> = {};
      let hasFailure = false;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        const settledItem = settledResults[i]!;
        results[key] = settledItem;
        if (settledItem.status === "rejected" || settledItem.value === false) {
          hasFailure = true;
        }
      }

      if (hasFailure) {
        if (nothrow) return false;
        throw buildSettledResults(results);
      }

      return true as const;
    },
  );
}
