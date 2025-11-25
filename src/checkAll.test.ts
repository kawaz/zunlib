import { describe, expect, test } from "bun:test";
import { checkAll } from "./checkAll";

describe("checkAll", () => {
  describe("単一入力", () => {
    test("同期condition true", async () => {
      const result = await checkAll(() => true);
      expect(result).toBe(true);
    });

    test("非同期condition true", async () => {
      const result = await checkAll(async () => true);
      expect(result).toBe(true);
    });

    test("Promiseそのまま", async () => {
      const result = await checkAll(Promise.resolve(true));
      expect(result).toBe(true);
    });

    test("falseでreject", async () => {
      await expect(checkAll(() => false)).rejects.toThrow();
    });
  });

  describe("配列入力", () => {
    test("全てtrueで成功", async () => {
      const result = await checkAll([() => true, () => true]);
      expect(result).toBe(true);
    });

    test("一つでもfalseでreject", async () => {
      await expect(checkAll([() => true, () => false])).rejects.toThrow();
    });

    test("async混在", async () => {
      const result = await checkAll([
        () => true,
        async () => true,
        Promise.resolve(true),
      ]);
      expect(result).toBe(true);
    });
  });

  describe("オブジェクト入力", () => {
    test("全てtrueで成功", async () => {
      const result = await checkAll({
        a: () => true,
        b: () => true,
      });
      expect(result).toBe(true);
    });

    test("一つでもfalseでreject", async () => {
      await expect(
        checkAll({
          a: () => true,
          b: () => false,
        }),
      ).rejects.toThrow();
    });

    test("async混在", async () => {
      const result = await checkAll({
        sync: () => true,
        async: async () => true,
        promise: Promise.resolve(true),
      });
      expect(result).toBe(true);
    });
  });

  describe("デフォルト (Promise.all相当)", () => {
    test("全てtrueで成功", async () => {
      const result = await checkAll({
        a: () => true,
        b: () => true,
      });
      expect(result).toBe(true);
    });

    test("falseでreject（エラーメッセージにキー名）", async () => {
      try {
        await checkAll({
          a: () => true,
          b: () => false,
        });
        expect(true).toBe(false);
      } catch (e) {
        expect((e as Error).message).toContain("b");
      }
    });

    test("エラーでreject", async () => {
      const error = new Error("test error");
      await expect(
        checkAll({
          a: () => true,
          b: () => {
            throw error;
          },
        }),
      ).rejects.toBe(error);
    });

    test("nothrow: true でfalse時はfalse", async () => {
      const result = await checkAll(
        {
          a: () => true,
          b: () => false,
        },
        { nothrow: true },
      );
      expect(result).toBe(false);
    });

    test("nothrow: true でエラー時はfalse", async () => {
      const result = await checkAll(
        {
          a: () => true,
          b: () => {
            throw new Error("fail");
          },
        },
        { nothrow: true },
      );
      expect(result).toBe(false);
    });
  });

  describe("settled: true (Promise.allSettled相当)", () => {
    test("全てtrueで成功", async () => {
      const result = await checkAll(
        {
          a: () => true,
          b: () => true,
        },
        { settled: true },
      );
      expect(result).toBe(true);
    });

    test("falseでSettled形式をreject", async () => {
      try {
        await checkAll(
          {
            a: () => true,
            b: () => false,
          },
          { settled: true },
        );
        expect(true).toBe(false);
      } catch (e) {
        const settled = e as {
          a: PromiseSettledResult<boolean>;
          b: PromiseSettledResult<boolean>;
        };
        expect(settled.a.status).toBe("fulfilled");
        expect((settled.a as PromiseFulfilledResult<boolean>).value).toBe(true);
        expect(settled.b.status).toBe("fulfilled");
        expect((settled.b as PromiseFulfilledResult<boolean>).value).toBe(
          false,
        );
      }
    });

    test("エラーでSettled形式をreject", async () => {
      try {
        await checkAll(
          {
            a: () => true,
            b: () => {
              throw new Error("fail");
            },
          },
          { settled: true },
        );
        expect(true).toBe(false);
      } catch (e) {
        const settled = e as {
          a: PromiseSettledResult<boolean>;
          b: PromiseSettledResult<boolean>;
        };
        expect(settled.a.status).toBe("fulfilled");
        expect(settled.b.status).toBe("rejected");
      }
    });

    test("配列形式でもSettled形式をreject", async () => {
      try {
        await checkAll([() => true, () => false], { settled: true });
        expect(true).toBe(false);
      } catch (e) {
        const settled = e as [
          PromiseSettledResult<boolean>,
          PromiseSettledResult<boolean>,
        ];
        expect(settled[0].status).toBe("fulfilled");
        expect((settled[0] as PromiseFulfilledResult<boolean>).value).toBe(
          true,
        );
        expect(settled[1].status).toBe("fulfilled");
        expect((settled[1] as PromiseFulfilledResult<boolean>).value).toBe(
          false,
        );
      }
    });

    test("nothrow: true でfalse時はfalse", async () => {
      const result = await checkAll(
        {
          a: () => true,
          b: () => false,
        },
        { settled: true, nothrow: true },
      );
      expect(result).toBe(false);
    });
  });

  describe("型推論", () => {
    test("成功時は true リテラル型", async () => {
      const result = await checkAll(() => true);
      // result は true
      expect(result).toBe(true);
    });

    test("nothrow時は boolean 型", async () => {
      const result = await checkAll(() => true, { nothrow: true });
      // result は boolean
      if (result) {
        expect(result).toBe(true);
      }
    });
  });
});
