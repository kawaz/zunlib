import { describe, expect, test } from "bun:test";
import { debounce } from "./debounce";

describe("debounce", () => {
  test("関数の実行が遅延される", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 50);

    debounced();
    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);
  });

  test("連続呼び出しでは1回だけ実行される", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 50);

    debounced();
    debounced();
    debounced();

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);
  });

  test("最後の呼び出しの引数が渡される", async () => {
    let lastArgs: [number, string] | undefined;
    const debounced = debounce((x: number, y: string) => {
      lastArgs = [x, y];
    }, 50);

    debounced(1, "a");
    debounced(2, "b");
    debounced(3, "c");

    await new Promise((r) => setTimeout(r, 60));
    expect(lastArgs).toEqual([3, "c"]);
  });

  test("cancelで実行がキャンセルされる", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 50);

    debounced();
    debounced.cancel();

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(0);
  });

  test("flushで即座に実行される", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 50);

    debounced();
    expect(callCount).toBe(0);

    debounced.flush();
    expect(callCount).toBe(1);

    // delay後に再度実行されない
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);
  });

  test("デフォルトのdelayは100ms", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++);

    debounced();
    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);
  });

  test("delayに関数を渡せる (ValueOrGetter)", async () => {
    let delay = 50;
    let callCount = 0;
    const debounced = debounce(() => callCount++, () => delay);

    debounced();
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);

    // delayを動的に変更
    delay = 100;
    debounced();
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1); // まだ呼ばれない

    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(2);
  });

  test("delayプロパティを実行時に変更できる", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 50);

    expect(debounced.delay).toBe(50);

    debounced.delay = 100;
    expect(debounced.delay).toBe(100);

    debounced();
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 50));
    expect(callCount).toBe(1);
  });

  test("オプションオブジェクトでdelayを指定できる", async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, { delay: 50 });

    debounced();
    await new Promise((r) => setTimeout(r, 60));
    expect(callCount).toBe(1);
  });

  describe("AbortSignal対応", () => {
    test("abortでキャンセルされる", async () => {
      let callCount = 0;
      const controller = new AbortController();
      const debounced = debounce(() => callCount++, {
        delay: 50,
        signal: controller.signal,
      });

      debounced();
      controller.abort();

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(0);
    });

    test("abort後の呼び出しは無視される", async () => {
      let callCount = 0;
      const controller = new AbortController();
      const debounced = debounce(() => callCount++, {
        delay: 50,
        signal: controller.signal,
      });

      controller.abort();
      debounced();

      await new Promise((r) => setTimeout(r, 60));
      expect(callCount).toBe(0);
    });

    test("timeout前にabortされると実行されない", async () => {
      let callCount = 0;
      const controller = new AbortController();
      const debounced = debounce(() => callCount++, {
        delay: 50,
        signal: controller.signal,
      });

      debounced();
      await new Promise((r) => setTimeout(r, 30));
      controller.abort();

      await new Promise((r) => setTimeout(r, 30));
      expect(callCount).toBe(0);
    });
  });
});
