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

/**
 * Options for bindTo method
 */
export type BindToOptions = {
  /** Whether the property shows up in enumeration (default: true) */
  enumerable?: boolean;
  /** Whether the property can be deleted or redefined (default: true) */
  configurable?: boolean;
};

/**
 * A wrapped ValueOrGetter with utility methods
 *
 * @typeParam T - The type of the value
 */
export type DynamicValue<T> = {
  /** Get the current value (resolves function if needed) */
  get: () => T;
  /** Set a new value or getter function */
  set: (newValue: ValueOrGetter<T>) => void;
  /** Get the raw ValueOrGetter (value or function) */
  source: ValueOrGetter<T>;
  /** Bind this dynamic value to an object property */
  bindTo: <O extends object>(
    obj: O,
    name: string,
    options?: BindToOptions,
  ) => void;
};

/**
 * Wraps a ValueOrGetter into a DynamicValue object
 *
 * Provides a convenient way to work with dynamic values and bind them
 * as properties to other objects.
 *
 * @typeParam T - The type of the value
 * @param initial - The initial value or getter function
 * @returns A DynamicValue object with get, set, source, and bindTo
 *
 * @example
 * ```typescript
 * const delay = toDynamic(100);
 * delay.get()    // => 100
 * delay.source   // => 100
 * delay.set(200)
 * delay.get()    // => 200
 *
 * // Dynamic getter
 * delay.set(() => config.delay);
 * delay.get()    // => current config.delay
 *
 * // Bind to another object
 * delay.bindTo(debounced, "delay");
 * debounced.delay        // => source (value or function)
 * debounced.delay = 300; // updates delay.get() too
 * ```
 */
export function toDynamic<T>(initial: ValueOrGetter<T>): DynamicValue<T> {
  let source: ValueOrGetter<T> = initial;
  let getter = toGetter(initial);

  const dynamic: DynamicValue<T> = {
    get: () => getter(),
    set: (newValue: ValueOrGetter<T>) => {
      source = newValue;
      getter = toGetter(newValue);
    },
    get source() {
      return source;
    },
    bindTo: <O extends object>(
      obj: O,
      name: string,
      options: BindToOptions = {},
    ) => {
      const { enumerable = true, configurable = true } = options;
      Object.defineProperty(obj, name, {
        get: () => source,
        set: dynamic.set,
        enumerable,
        configurable,
      });
    },
  };

  return dynamic;
}
