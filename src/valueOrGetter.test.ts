import { describe, expect, test } from "bun:test";
import { toGetter, toValue, type ValueOrGetter } from "./valueOrGetter";

describe("toValue", () => {
  test("値がそのまま返される", () => {
    expect(toValue(100)).toBe(100);
    expect(toValue("hello")).toBe("hello");
    expect(toValue(null)).toBe(null);
    expect(toValue(undefined)).toBe(undefined);
  });

  test("関数が呼び出されて結果が返される", () => {
    expect(toValue(() => 100)).toBe(100);
    expect(toValue(() => "hello")).toBe("hello");
  });

  test("オブジェクトも扱える", () => {
    const obj = { a: 1 };
    expect(toValue(obj)).toBe(obj);
    expect(toValue(() => obj)).toBe(obj);
  });
});

describe("toGetter", () => {
  test("値が関数でラップされる", () => {
    const getter = toGetter(100);
    expect(typeof getter).toBe("function");
    expect(getter()).toBe(100);
  });

  test("関数はそのまま返される", () => {
    const fn = () => 100;
    const getter = toGetter(fn);
    expect(getter).toBe(fn);
    expect(getter()).toBe(100);
  });

  test("getterは複数回呼び出せる", () => {
    let count = 0;
    const getter = toGetter(() => ++count);
    expect(getter()).toBe(1);
    expect(getter()).toBe(2);
    expect(getter()).toBe(3);
  });

  test("ラップされた値は毎回同じ値が返される", () => {
    const getter = toGetter(42);
    expect(getter()).toBe(42);
    expect(getter()).toBe(42);
    expect(getter()).toBe(42);
  });
});

describe("ValueOrGetter型", () => {
  test("値と関数の両方を受け入れられる", () => {
    const values: ValueOrGetter<number>[] = [100, () => 200];
    expect(toValue(values[0]!)).toBe(100);
    expect(toValue(values[1]!)).toBe(200);
  });
});
