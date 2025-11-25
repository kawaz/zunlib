import { describe, expect, test } from "bun:test";
import { setPolling, setSuperInterval, waitCond, waitValue } from "./wait";

describe("waitCond", () => {
  test("条件がすでにtrueならすぐ解決する", async () => {
    await waitCond(() => true);
  });

  test("条件がtrueになるまで待つ", async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 50);

    await waitCond(() => flag, { interval: 10 });
    expect(flag).toBe(true);
  });

  test("タイムアウトでエラーになる", async () => {
    expect(waitCond(() => false, { timeout: 50, interval: 10 })).rejects.toBe(
      "timeout",
    );
  });

  test("AbortSignalでキャンセルできる", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    expect(
      waitCond(() => false, { signal: controller.signal, timeout: 1000 }),
    ).rejects.toBe("signal");
  });

  test("すでにabortされたsignalは即座にエラー", async () => {
    const controller = new AbortController();
    controller.abort();

    expect(waitCond(() => true, { signal: controller.signal })).rejects.toBe(
      "signal",
    );
  });

  test("すでにabortされたsignal + nothrow: trueは即座に解決", async () => {
    const controller = new AbortController();
    controller.abort();

    await waitCond(() => false, { signal: controller.signal, nothrow: true });
    // rejectしなければOK
  });

  test("nothrowオプションでtimeout時にrejectせず解決する", async () => {
    await waitCond(() => false, {
      timeout: 50,
      interval: 10,
      nothrow: true,
    });
    // rejectしなければOK
  });

  test("nothrowオプションでabort時にrejectせず解決する", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    await waitCond(() => false, {
      signal: controller.signal,
      timeout: 1000,
      nothrow: true,
    });
    // rejectしなければOK
  });

  test("配列形式で複数条件を全て満たすまで待つ", async () => {
    let a = false;
    let b = false;
    setTimeout(() => {
      a = true;
    }, 20);
    setTimeout(() => {
      b = true;
    }, 40);

    await waitCond([() => a, () => b], { interval: 10 });
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  test("配列形式ですでに全条件を満たしていればすぐ解決する", async () => {
    await waitCond([() => true, () => true, () => true]);
  });

  test("配列形式で一部だけ満たしていれば待つ", async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 30);

    await waitCond([() => true, () => flag], { interval: 10 });
    expect(flag).toBe(true);
  });

  test("async条件をサポートする", async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 30);

    await waitCond(
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return flag;
      },
      { interval: 10 },
    );
    expect(flag).toBe(true);
  });

  test("配列形式でasync条件をサポートする", async () => {
    let a = false;
    let b = false;
    setTimeout(() => {
      a = true;
    }, 20);
    setTimeout(() => {
      b = true;
    }, 40);

    await waitCond(
      [
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          return a;
        },
        () => b,
      ],
      { interval: 10 },
    );
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  test("エラーをthrowする条件は握りつぶしてリトライする", async () => {
    let count = 0;
    await waitCond(
      () => {
        count++;
        if (count < 3) throw new Error("not ready");
        return true;
      },
      { interval: 10 },
    );
    expect(count).toBe(3);
  });

  test("rejectするPromiseは握りつぶしてリトライする", async () => {
    let count = 0;
    await waitCond(
      async () => {
        count++;
        if (count < 3) throw new Error("not ready");
        return true;
      },
      { interval: 10 },
    );
    expect(count).toBe(3);
  });
});

describe("waitValue", () => {
  test("値がすでにあればすぐ解決する", async () => {
    const result = await waitValue(() => "value");
    expect(result).toBe("value");
  });

  test("0はvalidな値として扱う", async () => {
    const result = await waitValue(() => 0);
    expect(result).toBe(0);
  });

  test("空文字はvalidな値として扱う", async () => {
    const result = await waitValue(() => "");
    expect(result).toBe("");
  });

  test("falseはvalidな値として扱う", async () => {
    const result = await waitValue(() => false);
    expect(result).toBe(false);
  });

  test("値が取得できるまで待つ", async () => {
    let value: string | null = null;
    setTimeout(() => {
      value = "found";
    }, 50);

    const result = await waitValue(() => value, { interval: 10 });
    expect(result).toBe("found");
  });

  test("undefinedからの値取得を待つ", async () => {
    let value: number | undefined;
    setTimeout(() => {
      value = 42;
    }, 50);

    const result = await waitValue(() => value, { interval: 10 });
    expect(result).toBe(42);
  });

  test("タイムアウトでエラーになる", async () => {
    expect(waitValue(() => null, { timeout: 50, interval: 10 })).rejects.toBe(
      "timeout",
    );
  });

  test("AbortSignalでキャンセルできる", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    expect(
      waitValue(() => null, { signal: controller.signal, timeout: 1000 }),
    ).rejects.toBe("signal");
  });

  test("すでにabortされたsignalは即座にエラー", async () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      waitValue(() => "value", { signal: controller.signal }),
    ).rejects.toBe("signal");
  });

  test("型推論が正しく動作する", async () => {
    const result = await waitValue(() => ({ name: "test" }));
    expect(result.name).toBe("test");
  });

  test("nothrowオプションでtimeout時にrejectせずnullを返す", async () => {
    const result = await waitValue(() => null, {
      timeout: 50,
      interval: 10,
      nothrow: true,
    });
    expect(result).toBe(null);
  });

  test("nothrowオプションでabort時にrejectせずnullを返す", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    const result = await waitValue(() => null, {
      signal: controller.signal,
      timeout: 1000,
      nothrow: true,
    });
    expect(result).toBe(null);
  });

  test("配列形式で複数のgetterを待てる", async () => {
    let a: string | null = null;
    let b: number | null = null;
    setTimeout(() => {
      a = "foo";
    }, 20);
    setTimeout(() => {
      b = 42;
    }, 40);

    const result = await waitValue([() => a, () => b], { interval: 10 });
    expect(result).toEqual(["foo", 42]);
  });

  test("オブジェクト形式で複数のgetterを待てる", async () => {
    let foo: string | null = null;
    let bar: number | null = null;
    setTimeout(() => {
      foo = "hello";
    }, 20);
    setTimeout(() => {
      bar = 123;
    }, 40);

    const result = await waitValue(
      { foo: () => foo, bar: () => bar },
      { interval: 10 },
    );
    expect(result).toEqual({ foo: "hello", bar: 123 });
  });

  test("配列形式ですでに値があればすぐ解決する", async () => {
    const result = await waitValue([() => "a", () => "b"]);
    expect(result).toEqual(["a", "b"]);
  });

  test("オブジェクト形式ですでに値があればすぐ解決する", async () => {
    const result = await waitValue({ x: () => 1, y: () => 2 });
    expect(result).toEqual({ x: 1, y: 2 });
  });

  test("async getterをサポートする", async () => {
    let value: string | null = null;
    setTimeout(() => {
      value = "async-value";
    }, 30);

    const result = await waitValue(
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return value;
      },
      { interval: 10 },
    );
    expect(result).toBe("async-value");
  });

  test("配列形式でasync getterをサポートする", async () => {
    let a: string | null = null;
    let b: number | null = null;
    setTimeout(() => {
      a = "foo";
    }, 20);
    setTimeout(() => {
      b = 42;
    }, 40);

    const result = await waitValue(
      [
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          return a;
        },
        () => b,
      ],
      { interval: 10 },
    );
    expect(result).toEqual(["foo", 42]);
  });

  test("オブジェクト形式でasync getterをサポートする", async () => {
    let foo: string | null = null;
    let bar: number | null = null;
    setTimeout(() => {
      foo = "hello";
    }, 20);
    setTimeout(() => {
      bar = 123;
    }, 40);

    const result = await waitValue(
      {
        foo: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return foo;
        },
        bar: () => bar,
      },
      { interval: 10 },
    );
    expect(result).toEqual({ foo: "hello", bar: 123 });
  });

  test("エラーをthrowするgetterは握りつぶしてリトライする", async () => {
    let count = 0;
    const result = await waitValue(
      () => {
        count++;
        if (count < 3) throw new Error("not ready");
        return "success";
      },
      { interval: 10 },
    );
    expect(result).toBe("success");
    expect(count).toBe(3);
  });

  test("rejectするPromiseは握りつぶしてリトライする", async () => {
    let count = 0;
    const result = await waitValue(
      async () => {
        count++;
        if (count < 3) throw new Error("not ready");
        return "success";
      },
      { interval: 10 },
    );
    expect(result).toBe("success");
    expect(count).toBe(3);
  });
});

describe("waitValue 型推論", () => {
  test("単一getterの型推論", async () => {
    const result = await waitValue(() => "hello");
    // resultはstring
    expect(result.toUpperCase()).toBe("HELLO");
  });

  test("単一async getterの型推論（Promise<T> → T）", async () => {
    const result = await waitValue(async () => 123);
    // resultはnumber（Promise<number>ではない）
    expect(result.toFixed(2)).toBe("123.00");
  });

  test("オブジェクト形式の型推論", async () => {
    const result = await waitValue({
      str: () => "hello",
      num: () => 123,
      bool: () => true,
    });
    // 各キーの型が正しく推論される
    expect(result.str.toUpperCase()).toBe("HELLO");
    expect(result.num.toFixed(2)).toBe("123.00");
    expect(result.bool === true).toBe(true);
  });

  test("オブジェクト形式でasync混在の型推論", async () => {
    const result = await waitValue({
      sync: () => "sync",
      async: async () => 123,
      promise: () => Promise.resolve(true),
    });
    // sync/async/Promise全て正しくTに解決
    expect(result.sync.toUpperCase()).toBe("SYNC");
    expect(result.async.toFixed(0)).toBe("123");
    expect(result.promise === true).toBe(true);
  });

  test("配列形式の型推論（as const）", async () => {
    const result = await waitValue([
      () => "hello",
      () => 123,
      () => true,
    ] as const);
    // タプルとして各要素の型が推論される
    const [str, num, bool] = result;
    expect(str.toUpperCase()).toBe("HELLO");
    expect(num.toFixed(0)).toBe("123");
    expect(bool === true).toBe(true);
  });

  test("配列形式でasync混在の型推論", async () => {
    const result = await waitValue([
      () => "sync",
      async () => 123,
      () => Promise.resolve(true),
    ] as const);
    const [str, num, bool] = result;
    expect(str.toUpperCase()).toBe("SYNC");
    expect(num.toFixed(0)).toBe("123");
    expect(bool === true).toBe(true);
  });

  test("nothrow時の型はnull許容", async () => {
    const result = await waitValue(() => "value", {
      timeout: 100,
      nothrow: true,
    });
    // result は string | null
    if (result !== null) {
      expect(result.toUpperCase()).toBe("VALUE");
    }
  });

  test("オブジェクト形式nothrow時の型はnull許容", async () => {
    const result = await waitValue(
      { foo: () => "hello" },
      { timeout: 100, nothrow: true },
    );
    // result は { foo: string } | null
    if (result !== null) {
      expect(result.foo.toUpperCase()).toBe("HELLO");
    }
  });
});

describe("setSuperInterval", () => {
  test("指定した間隔でコールバックが実行される", async () => {
    let count = 0;
    const { stop } = setSuperInterval(() => count++, { interval: 20 });

    await new Promise((r) => setTimeout(r, 70));
    stop();

    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
  });

  test("stopで停止できる", async () => {
    let count = 0;
    const { stop } = setSuperInterval(() => count++, { interval: 20 });

    await new Promise((r) => setTimeout(r, 50));
    stop();
    const countAtStop = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtStop);
  });

  test("AbortSignalで停止できる", async () => {
    let count = 0;
    const controller = new AbortController();
    setSuperInterval(() => count++, {
      interval: 20,
      signal: controller.signal,
    });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    const countAtAbort = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtAbort);
  });

  test("すでにabortされたsignalは実行されない", async () => {
    let count = 0;
    const controller = new AbortController();
    controller.abort();

    setSuperInterval(() => count++, {
      interval: 10,
      signal: controller.signal,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(0);
  });

  test("immediate: trueで即座に1回実行される", async () => {
    let callCount = 0;
    const { stop } = setSuperInterval(() => callCount++, {
      interval: 100,
      immediate: true,
    });

    expect(callCount).toBe(1); // 即座に実行
    stop();
  });

  test("timeoutで自動停止する", async () => {
    let count = 0;
    setSuperInterval(() => count++, { interval: 20, timeout: 60 });

    await new Promise((r) => setTimeout(r, 100));
    const countAtTimeout = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtTimeout);
  });
});

describe("setPolling", () => {
  test("指定した間隔でコールバックが実行される", async () => {
    let count = 0;
    const { stop } = setPolling(() => count++, { interval: 20, timeout: 1000 });

    await new Promise((r) => setTimeout(r, 70));
    stop();

    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("タイムアウトで自動停止する", async () => {
    let count = 0;
    setPolling(() => count++, { interval: 20, timeout: 60 });

    await new Promise((r) => setTimeout(r, 100));
    const countAtTimeout = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtTimeout);
  });

  test("stopで停止できる", async () => {
    let count = 0;
    const { stop } = setPolling(() => count++, { interval: 20, timeout: 1000 });

    await new Promise((r) => setTimeout(r, 50));
    stop();
    const countAtStop = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtStop);
  });

  test("AbortSignalで停止できる", async () => {
    let count = 0;
    const controller = new AbortController();
    setPolling(() => count++, {
      interval: 20,
      timeout: 1000,
      signal: controller.signal,
    });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    const countAtAbort = count;

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtAbort);
  });

  test("immediate: trueで即座に1回実行される", async () => {
    let callCount = 0;
    const { stop } = setPolling(() => callCount++, {
      interval: 100,
      timeout: 1000,
      immediate: true,
    });

    expect(callCount).toBe(1); // 即座に実行
    stop();
  });

  test("すでにabortされたsignalは実行されない", async () => {
    let count = 0;
    const controller = new AbortController();
    controller.abort();

    setPolling(() => count++, {
      interval: 10,
      signal: controller.signal,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(0);
  });

  test("abort()でonabortが'manual'で呼ばれる", async () => {
    let abortReason: string | undefined;
    let count = 0;
    const { abort } = setPolling(() => count++, {
      interval: 20,
      timeout: 1000,
      onabort: (reason) => {
        abortReason = reason;
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    abort();
    const countAtAbort = count;

    expect(abortReason).toBe("manual");

    // abort後はコールバックが呼ばれない
    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(countAtAbort);
  });

  test("abort()を複数回呼んでもonabortは1回だけ", async () => {
    let abortCount = 0;
    const { abort } = setPolling(() => {}, {
      interval: 20,
      onabort: () => {
        abortCount++;
      },
    });

    abort();
    abort();
    abort();

    expect(abortCount).toBe(1);
  });
});
