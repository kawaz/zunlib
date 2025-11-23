import { describe, expect, test } from "bun:test";
import { throttle } from "./throttle";

describe("throttle", () => {
  test("最初の呼び出しは即座に実行される", () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled();
    expect(callCount).toBe(1);
  });

  test("インターバル内の呼び出しは1回にまとめられる", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled(); // 即座に実行
    throttled(); // 無視、引数保存
    throttled(); // 無視、引数更新

    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(2); // trailing実行
  });

  test("最後の呼び出しの引数が渡される", async () => {
    let lastArgs: [number, string] | undefined;
    const throttled = throttle((x: number, y: string) => {
      lastArgs = [x, y];
    }, 50);

    throttled(1, "a"); // 即座に実行
    throttled(2, "b");
    throttled(3, "c");

    expect(lastArgs).toEqual([1, "a"]);

    await new Promise((r) => setTimeout(r, 60));
    expect(lastArgs).toEqual([3, "c"]);
  });

  test("cancelで待機中の実行がキャンセルされる", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, 50);

    throttled(); // 即座に実行
    throttled(); // 待機
    throttled.cancel();

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1); // trailing実行されない
  });

  test("デフォルトのintervalは100ms", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++);

    throttled(); // 即座に実行
    throttled();

    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(1); // まだtrailingされない

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(2);
  });

  test("intervalに関数を渡せる (ValueOrGetter)", async () => {
    let interval = 50;
    let callCount = 0;
    const throttled = throttle(
      () => callCount++,
      () => interval,
    );

    throttled();
    expect(callCount).toBe(1);

    throttled();
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(2);

    // intervalを動的に変更して確認
    interval = 30;
    await new Promise((r) => setTimeout(r, 40));
    throttled(); // 新しいinterval(30ms)が経過したので即座に実行
    expect(callCount).toBe(3);
  });

  test("intervalプロパティを実行時に変更できる", () => {
    const throttled = throttle(() => {}, 50);

    expect(throttled.interval).toBe(50);

    throttled.interval = 100;
    expect(throttled.interval).toBe(100);
  });

  test("オプションオブジェクトでintervalを指定できる", async () => {
    let callCount = 0;
    const throttled = throttle(() => callCount++, { interval: 50 });

    throttled();
    throttled();

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(2);
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

  describe("leading/trailing オプション", () => {
    test("leading: falseで最初の呼び出しが遅延される", async () => {
      let callCount = 0;
      const throttled = throttle(() => callCount++, {
        interval: 50,
        leading: false,
      });

      throttled();
      expect(callCount).toBe(0); // 即座に実行されない

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(1); // trailing実行
    });

    test("trailing: falseでインターバル後の実行がスキップされる", async () => {
      let callCount = 0;
      const throttled = throttle(() => callCount++, {
        interval: 50,
        trailing: false,
      });

      throttled(); // 即座に実行
      throttled(); // trailing無効なので保存されない
      throttled();

      expect(callCount).toBe(1);

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(1); // trailing実行されない
    });

    test("leadingプロパティを実行時に変更できる", () => {
      const throttled = throttle(() => {}, { interval: 50 });

      expect(throttled.leading).toBe(true);

      throttled.leading = false;
      expect(throttled.leading).toBe(false);
    });

    test("trailingプロパティを実行時に変更できる", () => {
      const throttled = throttle(() => {}, { interval: 50 });

      expect(throttled.trailing).toBe(true);

      throttled.trailing = false;
      expect(throttled.trailing).toBe(false);
    });

    test("leading: false, trailing: falseでは何も実行されない", async () => {
      let callCount = 0;
      const throttled = throttle(() => callCount++, {
        interval: 50,
        leading: false,
        trailing: false,
      });

      throttled();
      throttled();

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(0);
    });

    test("leading: falseで連続呼び出し後も正しいインターバルが維持される", async () => {
      const calls: number[] = [];
      const startTime = Date.now();
      const throttled = throttle(() => calls.push(Date.now() - startTime), {
        interval: 50,
        leading: false,
      });

      // 最初の呼び出し (50ms後に実行予定)
      throttled();

      // 60ms待機 (1回目実行済み)
      await new Promise((r) => setTimeout(r, 60));
      expect(calls.length).toBe(1);

      // 2回目の呼び出し (即座にインターバル経過しているので50ms後に実行)
      throttled();

      // 60ms待機 (2回目実行済み)
      await new Promise((r) => setTimeout(r, 60));
      expect(calls.length).toBe(2);

      // 2回目の実行が1回目から適切な間隔で行われているか確認
      // (lastCallTimeが正しく更新されていないと間隔がおかしくなる)
      // タイマーの誤差を考慮して少し緩めに判定
      expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(45);
    });
  });

  describe("AbortSignal対応", () => {
    test("abortでキャンセルされる", async () => {
      let callCount = 0;
      const controller = new AbortController();
      const throttled = throttle(() => callCount++, {
        interval: 50,
        signal: controller.signal,
      });

      throttled(); // 即座に実行
      throttled(); // 待機
      controller.abort();

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(1); // trailing実行されない
    });

    test("abort後の呼び出しは無視される", async () => {
      let callCount = 0;
      const controller = new AbortController();
      const throttled = throttle(() => callCount++, {
        interval: 50,
        signal: controller.signal,
      });

      controller.abort();
      throttled();

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(0);
    });
  });
});
