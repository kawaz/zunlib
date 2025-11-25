import { describe, expect, mock, test } from "bun:test";
import { createKeywordMatcher, onUrlMatch, wildcardToRegExp } from "./matcher";

describe("createKeywordMatcher", () => {
  test("単純なキーワードにマッチする", () => {
    const matcher = createKeywordMatcher("GOOGLE PLAY");
    expect(matcher("GOOGLE PLAY")).toBe(true);
    expect(matcher("OTHER")).toBe(false);
  });

  test("部分一致でマッチする", () => {
    const matcher = createKeywordMatcher("GOOGLE PLAY");
    expect(matcher("ほげ GOOGLE PLAY ああ")).toBe(true);
    expect(matcher("GOOGLE PLAY決済")).toBe(true);
  });

  test("複数行のキーワードを処理できる", () => {
    const matcher = createKeywordMatcher(`
      GOOGLE PLAY
      APPLE COM BILL
      楽天モバイル
    `);
    expect(matcher("GOOGLE PLAY")).toBe(true);
    expect(matcher("APPLE COM BILL")).toBe(true);
    expect(matcher("楽天モバイル")).toBe(true);
    expect(matcher("未知のサービス")).toBe(false);
  });

  test("// コメントが無視される", () => {
    const matcher = createKeywordMatcher(`
      チャーミ //ボタン電池
      APPLE // App Store
    `);
    expect(matcher("チャーミ")).toBe(true);
    expect(matcher("ボタン電池")).toBe(false);
    expect(matcher("APPLE")).toBe(true);
    expect(matcher("App Store")).toBe(false);
  });

  test("# コメントが無視される", () => {
    const matcher = createKeywordMatcher(`
      キーワード # これはコメント
    `);
    expect(matcher("キーワード")).toBe(true);
    expect(matcher("これはコメント")).toBe(false);
  });

  test("/pattern/flags 形式の正規表現を処理できる", () => {
    const matcher = createKeywordMatcher(`
      /^特P$/
      /test/i
    `);
    expect(matcher("特P")).toBe(true);
    expect(matcher("特P駐車場")).toBe(false); // 完全一致
    expect(matcher("TEST")).toBe(true); // case insensitive
    expect(matcher("test")).toBe(true);
  });

  test("RegExpを直接渡せる", () => {
    const matcher = createKeywordMatcher(/^exact$/);
    expect(matcher("exact")).toBe(true);
    expect(matcher("not exact")).toBe(false);
  });

  test("配列を渡せる", () => {
    const matcher = createKeywordMatcher(["foo", "bar"]);
    expect(matcher("foo")).toBe(true);
    expect(matcher("bar")).toBe(true);
    expect(matcher("baz")).toBe(false);
  });

  test("複数の入力を配列で渡せる", () => {
    const matcher = createKeywordMatcher([
      "keyword1",
      ["keyword2", "keyword3"],
      /^regex$/,
    ]);
    expect(matcher("keyword1")).toBe(true);
    expect(matcher("keyword2")).toBe(true);
    expect(matcher("keyword3")).toBe(true);
    expect(matcher("regex")).toBe(true);
    expect(matcher("other")).toBe(false);
  });

  test("ネストした配列を処理できる", () => {
    const matcher = createKeywordMatcher([["nested", ["deep"]]]);
    expect(matcher("nested")).toBe(true);
    expect(matcher("deep")).toBe(true);
  });

  test("空の入力でもエラーにならない", () => {
    const matcher = createKeywordMatcher("");
    expect(matcher("anything")).toBe(false);
  });

  test("正規表現のメタ文字がエスケープされる", () => {
    const matcher = createKeywordMatcher("foo.bar");
    expect(matcher("foo.bar")).toBe(true);
    expect(matcher("fooXbar")).toBe(false); // . がリテラルとして扱われる
  });

  test("実用例: クレカ明細フィルタ", () => {
    const isApproved = createKeywordMatcher(`
      GOOGLE PLAY
      APPLE COM BILL
      楽天モバイル
      /^特P$/
    `);

    expect(isApproved("GOOGLE PLAY JPN")).toBe(true);
    expect(isApproved("APPLE COM BILL")).toBe(true);
    expect(isApproved("楽天モバイル利用料")).toBe(true);
    expect(isApproved("特P")).toBe(true);
    expect(isApproved("特P駐車場")).toBe(false);
    expect(isApproved("不明な請求")).toBe(false);
  });
});

describe("wildcardToRegExp", () => {
  test("* は任意の文字列にマッチする", () => {
    const re = wildcardToRegExp("*.txt");
    expect(re.test("file.txt")).toBe(true);
    expect(re.test("document.txt")).toBe(true);
    expect(re.test(".txt")).toBe(true);
    expect(re.test("file.txt.bak")).toBe(false);
  });

  test("複数の * を使える", () => {
    const re = wildcardToRegExp("https://*.example.com/*");
    expect(re.test("https://api.example.com/path")).toBe(true);
    expect(re.test("https://www.example.com/foo/bar")).toBe(true);
    expect(re.test("http://api.example.com/path")).toBe(false);
  });

  test("メタ文字がエスケープされる", () => {
    const re = wildcardToRegExp("file[1].txt");
    expect(re.test("file[1].txt")).toBe(true);
    expect(re.test("file1.txt")).toBe(false);
  });

  test("完全一致である", () => {
    const re = wildcardToRegExp("foo");
    expect(re.test("foo")).toBe(true);
    expect(re.test("foobar")).toBe(false);
    expect(re.test("barfoo")).toBe(false);
  });

  test("flags を渡せる", () => {
    const re = wildcardToRegExp("*.TXT", "i");
    expect(re.test("file.txt")).toBe(true);
    expect(re.test("file.TXT")).toBe(true);
  });
});

describe("createKeywordMatcher with wildcard option", () => {
  test("wildcard: true で * がワイルドカードとして扱われる", () => {
    const matcher = createKeywordMatcher(
      `
      https://*.example.com/*
      https://api.foo.com/*
    `,
      { wildcard: true },
    );
    expect(matcher("https://api.example.com/path")).toBe(true);
    expect(matcher("https://www.example.com/foo/bar")).toBe(true);
    expect(matcher("https://api.foo.com/v1/users")).toBe(true);
    expect(matcher("http://api.example.com/path")).toBe(false);
  });

  test("wildcard: false (デフォルト) で * がリテラルとして扱われる", () => {
    const matcher = createKeywordMatcher("foo*bar");
    expect(matcher("foo*bar")).toBe(true);
    expect(matcher("foobazbar")).toBe(false);
  });

  test("wildcard: true でも /regex/ は正規表現として扱われる", () => {
    const matcher = createKeywordMatcher(
      `
      https://*.example.com/*
      /^https?:\\/\\/special\\./
    `,
      { wildcard: true },
    );
    expect(matcher("https://api.example.com/")).toBe(true);
    expect(matcher("http://special.com")).toBe(true);
  });
});

describe("onUrlMatch", () => {
  test("location.href がパターンにマッチしたらコールバックを実行", () => {
    // @ts-expect-error - mock global location
    globalThis.location = { href: "https://api.example.com/path" };

    const callback = mock(() => {});
    onUrlMatch("https://*.example.com/*", callback);
    expect(callback).toHaveBeenCalled();
  });

  test("location.href がパターンにマッチしなければコールバックを実行しない", () => {
    // @ts-expect-error - mock global location
    globalThis.location = { href: "https://other.com/path" };

    const callback = mock(() => {});
    onUrlMatch("https://*.example.com/*", callback);
    expect(callback).not.toHaveBeenCalled();
  });
});
