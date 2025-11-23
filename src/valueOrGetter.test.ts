import { describe, expect, test } from "bun:test";
import {
  toDynamic,
  toGetter,
  toValue,
  type ValueOrGetter,
} from "./valueOrGetter";

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

describe("toDynamic", () => {
  test("get()で値を取得できる", () => {
    const dv = toDynamic(100);
    expect(dv.get()).toBe(100);
  });

  test("sourceで元の値を取得できる", () => {
    const dv = toDynamic(100);
    expect(dv.source).toBe(100);
  });

  test("関数を渡した場合get()は評価された値を返す", () => {
    let value = 100;
    const dv = toDynamic(() => value);

    expect(dv.get()).toBe(100);

    value = 200;
    expect(dv.get()).toBe(200);
  });

  test("関数を渡した場合sourceは関数を返す", () => {
    const fn = () => 100;
    const dv = toDynamic(fn);
    expect(dv.source).toBe(fn);
  });

  test("set()で値を更新できる", () => {
    const dv = toDynamic(100);

    dv.set(200);
    expect(dv.get()).toBe(200);
    expect(dv.source).toBe(200);
  });

  test("set()で関数を設定できる", () => {
    const dv = toDynamic(100 as ValueOrGetter<number>);
    let value = 200;
    const fn = () => value;

    dv.set(fn);
    expect(dv.get()).toBe(200);
    expect(dv.source).toBe(fn);

    value = 300;
    expect(dv.get()).toBe(300);
  });

  test("bindToでオブジェクトにプロパティを定義できる", () => {
    const dv = toDynamic(100);
    const obj: { delay?: ValueOrGetter<number> } = {};

    dv.bindTo(obj, "delay");

    expect(obj.delay).toBe(100);
  });

  test("bindTo後もget()で値を取得できる", () => {
    const dv = toDynamic(100);
    const obj: { delay?: ValueOrGetter<number> } = {};

    dv.bindTo(obj, "delay");

    expect(dv.get()).toBe(100);
  });

  test("bindTo後にプロパティを更新するとget()も更新される", () => {
    const dv = toDynamic(100);
    const obj: { delay?: ValueOrGetter<number> } = {};

    dv.bindTo(obj, "delay");

    obj.delay = 200;
    expect(obj.delay).toBe(200);
    expect(dv.get()).toBe(200);
    expect(dv.source).toBe(200);
  });

  test("プロパティに関数を設定するとget()はその関数を評価する", () => {
    const dv = toDynamic(100 as ValueOrGetter<number>);
    const obj: { delay?: ValueOrGetter<number> } = {};

    dv.bindTo(obj, "delay");

    let value = 200;
    obj.delay = () => value;

    expect(dv.get()).toBe(200);
    expect(typeof dv.source).toBe("function");

    value = 300;
    expect(dv.get()).toBe(300);
  });
});
