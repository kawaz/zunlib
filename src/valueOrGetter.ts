/**
 * A value or a function that returns the value
 *
 * @typeParam T - The type of the value
 */
export type ValueOrGetter<T> = T | (() => T);

/**
 * Converts a ValueOrGetter to a value
 *
 * Use when you need the value only once.
 *
 * @typeParam T - The type of the value
 * @param value - The value or function to convert
 * @returns The value
 *
 * @example
 * ```typescript
 * toValue(100)        // => 100
 * toValue(() => 100)  // => 100
 * ```
 */
export function toValue<T>(value: ValueOrGetter<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

/**
 * Converts a ValueOrGetter to a getter function
 *
 * Use when you need to get the value multiple times.
 *
 * @typeParam T - The type of the value
 * @param value - The value or function to convert
 * @returns A function that returns the value
 *
 * @example
 * ```typescript
 * const fn = toGetter(100)  // => () => 100
 * fn() // => 100
 * ```
 */
export function toGetter<T>(value: ValueOrGetter<T>): () => T {
  return typeof value === "function" ? (value as () => T) : () => value;
}
