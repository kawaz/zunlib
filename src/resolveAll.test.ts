import { describe, expect, test } from "bun:test";
import { resolveAll } from "./resolveAll";

describe("resolveAll", () => {
  describe("単一入力", () => {
    test("同期getter", async () => {
      const result = await resolveAll(() => "hello");
      expect(result).toBe("hello");
    });

    test("非同期getter", async () => {
      const result = await resolveAll(async () => "async");
      expect(result).toBe("async");
    });

    test("Promiseそのまま", async () => {
      const result = await resolveAll(Promise.resolve("promise"));
      expect(result).toBe("promise");
    });
  });

  describe("配列入力", () => {
    test("同期getterの配列", async () => {
      const result = await resolveAll([() => "a", () => "b"] as const);
      expect(result).toEqual(["a", "b"]);
    });

    test("非同期getter混在の配列", async () => {
      const result = await resolveAll([
        () => "sync",
        async () => "async",
        Promise.resolve("promise"),
      ] as const);
      expect(result).toEqual(["sync", "async", "promise"]);
    });
  });

  describe("オブジェクト入力", () => {
    test("同期getterのオブジェクト", async () => {
      const result = await resolveAll({
        foo: () => "hello",
        bar: () => 123,
      });
      expect(result).toEqual({ foo: "hello", bar: 123 });
    });

    test("非同期getter混在のオブジェクト", async () => {
      const result = await resolveAll({
        sync: () => "sync",
        async: async () => "async",
        promise: Promise.resolve("promise"),
      });
      expect(result).toEqual({
        sync: "sync",
        async: "async",
        promise: "promise",
      });
    });
  });

  describe("デフォルト (Promise.all相当)", () => {
    test("全て成功で値を返す", async () => {
      const result = await resolveAll({
        a: () => 1,
        b: () => 2,
      });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test("エラーで最初のErrorをreject", async () => {
      const error = new Error("test error");
      await expect(
        resolveAll({
          a: () => 1,
          b: () => {
            throw error;
          },
        }),
      ).rejects.toBe(error);
    });

    test("nothrow: true でエラー時null", async () => {
      const result = await resolveAll(
        {
          a: () => 1,
          b: () => {
            throw new Error("fail");
          },
        },
        { nothrow: true },
      );
      expect(result).toBeNull();
    });
  });

  describe("settled: true (Promise.allSettled相当)", () => {
    test("全て成功で値を返す", async () => {
      const result = await resolveAll(
        {
          a: () => 1,
          b: () => 2,
        },
        { settled: true },
      );
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test("エラーでSettled形式をreject", async () => {
      try {
        await resolveAll(
          {
            a: () => "success",
            b: () => {
              throw new Error("fail");
            },
          },
          { settled: true },
        );
        expect(true).toBe(false); // should not reach
      } catch (e) {
        const settled = e as {
          a: PromiseSettledResult<string>;
          b: PromiseSettledResult<string>;
        };
        expect(settled.a.status).toBe("fulfilled");
        expect((settled.a as PromiseFulfilledResult<string>).value).toBe(
          "success",
        );
        expect(settled.b.status).toBe("rejected");
        expect((settled.b as PromiseRejectedResult).reason).toBeInstanceOf(
          Error,
        );
      }
    });

    test("配列形式でもSettled形式をreject", async () => {
      try {
        await resolveAll(
          [
            () => "success",
            () => {
              throw new Error("fail");
            },
          ] as const,
          { settled: true },
        );
        expect(true).toBe(false);
      } catch (e) {
        const settled = e as [
          PromiseSettledResult<string>,
          PromiseSettledResult<never>,
        ];
        expect(settled[0].status).toBe("fulfilled");
        expect(settled[1].status).toBe("rejected");
      }
    });

    test("nothrow: true でエラー時null", async () => {
      const result = await resolveAll(
        {
          a: () => "success",
          b: () => {
            throw new Error("fail");
          },
        },
        { settled: true, nothrow: true },
      );
      expect(result).toBeNull();
    });
  });

  describe("型推論", () => {
    test("単一getterの型", async () => {
      const result = await resolveAll(() => "hello");
      expect(result.toUpperCase()).toBe("HELLO");
    });

    test("Promiseの型", async () => {
      const result = await resolveAll(Promise.resolve(123));
      expect(result.toFixed(2)).toBe("123.00");
    });

    test("オブジェクト形式の各キーの型", async () => {
      const result = await resolveAll({
        str: () => "hello",
        num: async () => 123,
        bool: Promise.resolve(true),
      });
      expect(result.str.toUpperCase()).toBe("HELLO");
      expect(result.num.toFixed(0)).toBe("123");
      expect(result.bool === true).toBe(true);
    });

    test("配列形式の各要素の型（as const）", async () => {
      const result = await resolveAll([
        () => "hello",
        async () => 123,
        Promise.resolve(true),
      ] as const);
      const [str, num, bool] = result;
      expect(str.toUpperCase()).toBe("HELLO");
      expect(num.toFixed(0)).toBe("123");
      expect(bool === true).toBe(true);
    });

    test("nothrow時はnull許容", async () => {
      const result = await resolveAll(() => "value", { nothrow: true });
      if (result !== null) {
        expect(result.toUpperCase()).toBe("VALUE");
      }
    });
  });
});
