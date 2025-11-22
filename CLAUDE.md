# zunlib

JavaScript/TypeScript向けの小さなユーティリティ関数・型のコレクション。

## プロジェクト概要

`@kawaz/zunlib` - 元々gistにメモ代わりに保存していた独立した小さな関数群をまとめた個人用ユーティリティライブラリ。

## 開発ガイドライン

### パッケージマネージャ
- **bun** を使用
- `bun install` - 依存関係インストール
- `bun test` - テスト実行
- `bun run build` - ビルド

### ツール
- **Linter/Formatter**: oxlint (`bun run lint`, `bun run format`)
- **Bundler**: bun build (tree-shaking対応)
- **TypeScript**: strictモード有効

### コード構成
- 各ユーティリティは独自ファイル: `src/{utility}.ts`
- 全exportを `src/index.ts` に集約
- テストはソースと同階層: `src/{utility}.test.ts`
- ユーティリティ間の依存禁止(原則) - 各機能は独立させる
  - 大→小の依存は許容（tree-shakingで必要分だけ残る）
  - 小→大の依存は禁止（不要なコードがバンドルされる）

### 新規ユーティリティの追加手順
1. `src/{name}.ts` に実装を作成
2. `src/{name}.test.ts` にテストを作成
3. `src/index.ts` からexport
4. 単独importが必要なら `package.json` の exports に追加
5. ビルドスクリプトに新エントリポイントを追加

### 設計原則
- 自己完結: 各ユーティリティは独立して動作
- Tree-shakeable: 副作用なし、適切なESM exports
- TypeScript-first: 型安全、型のexport
- 最小限: 必要なものだけ、過剰な設計をしない

### npm公開
- パッケージ名: `@kawaz/zunlib`
- mainブランチpush時にversion変更があれば自動publish
- GitHubに `NPM_TOKEN` シークレットが必要

### コマンド
```bash
bun install      # 依存関係インストール
bun run lint     # Linter実行
bun run format   # コード整形
bun test         # テスト実行
bun run build    # プロダクションビルド
```

## 予定ユーティリティ
- debounce - 関数呼び出しのデバウンス
- throttle - 関数呼び出しのスロットル
- binconv - バイナリ変換ユーティリティ
- worker - Web Workerヘルパー
- duckdb - DuckDBユーティリティ
- datetime - 日付/時刻ユーティリティ

## 言語ルール
- CLAUDE.md等のドキュメント類はREADME以外は日本語
- 会話も日本語
- TSDocは英語
