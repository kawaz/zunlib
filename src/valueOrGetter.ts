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
  /** Bind this dynamic value to an object property and return the object with the new property type */
  bindTo: <O extends object, K extends string>(
    obj: O,
    name: K,
    options?: BindToOptions,
  ) => O & Record<K, ValueOrGetter<T>>;
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
    bindTo: (obj, name, options) => {
      bindTo(
        obj,
        { [name]: dynamic } as Record<typeof name, typeof dynamic>,
        options,
      );
      return obj as typeof obj & Record<typeof name, ValueOrGetter<T>>;
    },
  };

  return dynamic;
}

/**
 * Binds multiple DynamicValues to an object as properties
 *
 * Uses Object.defineProperty to create getter/setter pairs that
 * automatically sync with the DynamicValue instances.
 *
 * @typeParam O - The object type to bind to
 * @typeParam B - The bindings record type
 * @param obj - The object to bind properties to
 * @param bindings - Record of property names to DynamicValue instances
 * @param options - Optional property descriptor options
 *
 * @example
 * ```typescript
 * const delay = toDynamic(100);
 * const leading = toDynamic(true);
 * const obj = {};
 *
 * bindTo(obj, { delay, leading });
 * obj.delay    // => 100
 * obj.leading  // => true
 * ```
 */
export function bindTo<
  O extends object,
  B extends Record<string, DynamicValue<any>>,
>(
  obj: O,
  bindings: B,
  options: BindToOptions = {},
): asserts obj is O & {
  [K in keyof B]: B[K] extends DynamicValue<infer T> ? ValueOrGetter<T> : never;
} {
  const { enumerable = true, configurable = true } = options;
  for (const [name, dynamic] of Object.entries(bindings)) {
    Object.defineProperty(obj, name, {
      get: () => dynamic.source,
      set: (newValue) => dynamic.set(newValue),
      enumerable,
      configurable,
    });
  }
}
