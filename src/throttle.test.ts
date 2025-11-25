import { describe, expect, test } from "bun:test";
import { throttle } from "./throttle";

describe("throttle", () => {
  test("最初の呼び出しは即座に実行される", () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled();
    expect(callCount).toBe(1);
  });

  test("インターバル内の呼び出しは無視される", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled(); // 即座に実行
    throttled(); // 無視
    throttled(); // 無視

    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1); // trailing実行はない
  });

  test("intervalプロパティで設定値を確認できる", () => {
    const throttled = throttle(() => {}, 50);
    expect(throttled.interval).toBe(50);
  });

  test("デフォルトのintervalは100ms", () => {
    const throttled = throttle(() => {});
    expect(throttled.interval).toBe(100);
  });

  test("インターバル経過後は再度即座に実行される", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled();
    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 60));

    throttled();
    expect(callCount).toBe(2); // 即座に実行
  });

  test("引数が正しく渡される", () => {
    let lastArgs: [number, string] | undefined;
    const throttled = throttle((x: number, y: string) => {
      lastArgs = [x, y];
    }, 50);

    throttled(1, "a");
    expect(lastArgs).toEqual([1, "a"]);
  });

  test("intervalを動的に変更できる", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled();
    expect(callCount).toBe(1);

    throttled.interval = 200;

    await new Promise((r) => setTimeout(r, 60));
    throttled();
    expect(callCount).toBe(1); // まだinterval内

    await new Promise((r) => setTimeout(r, 150));
    throttled();
    expect(callCount).toBe(2); // interval経過
  });
});
