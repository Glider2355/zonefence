# zonefence

TypeScriptプロジェクト向けのフォルダ単位アーキテクチャ・ガードレール

## インストール

```bash
npm install -D zonefence
# または
pnpm add -D zonefence
```

## 使い方

### ルールファイルの作成

保護したいフォルダに `zonefence.yaml` を配置します：

```yaml
version: 1

description: "Domain層 - 外部依存を持たない純粋なビジネスロジック"

imports:
  allow:
    - from: "./**"           # 同フォルダ内のimportを許可
    - from: "@/shared/**"    # 共有モジュールを許可
  deny:
    - from: "axios"
      message: "Domain層は外部HTTPライブラリに依存してはいけません"
    - from: "../infrastructure/**"
      message: "Domain層からInfrastructure層への依存は禁止です"
```

### チェックの実行

```bash
npx zonefence check ./src
```

## ルールスキーマ

```yaml
version: 1

description: "このフォルダの設計意図を説明"

scope:
  apply: descendants  # "self" | "descendants"
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"

imports:
  allow:
    - from: "./**"           # 同フォルダ内
    - from: "@/shared/**"    # 共有モジュール
  deny:
    - from: "../infrastructure/**"
      message: "Domain層からInfrastructure層への依存は禁止"
  mode: allow-first  # デフォルト
```

### 設定オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `version` | スキーマバージョン（現在は1のみ） | 必須 |
| `description` | フォルダの設計意図の説明 | - |
| `scope.apply` | ルールの適用範囲（`self`: 自フォルダのみ、`descendants`: 子孫フォルダにも適用） | `descendants` |
| `scope.exclude` | チェック対象から除外するファイルパターン | `[]` |
| `imports.allow` | 許可するimportパターンのリスト | `[]` |
| `imports.deny` | 禁止するimportパターンのリスト | `[]` |
| `imports.mode` | 評価モード（`allow-first`: 許可リスト優先、`deny-first`: 禁止リスト優先） | `allow-first` |

### 評価モード

#### `allow-first`（デフォルト）

1. `deny`ルールにマッチしたらエラー
2. `allow`ルールが定義されている場合、いずれかにマッチしなければエラー

#### `deny-first`

1. `allow`ルールにマッチしたら許可
2. `deny`ルールにマッチしたらエラー
3. どちらにもマッチしなければ許可

## パスのマッチング

### 解決済みパス

相対パス（`../shared/utils`）とエイリアス（`@/shared/utils`）が同じファイルを指す場合、ts-morphで解決した絶対パスに対してマッチングを行います。これにより、書き方に関係なく同じルールが適用されます。

### 外部パッケージ

解決できないモジュール（外部パッケージ）は、元のモジュール指定子でマッチングします。

```yaml
imports:
  allow:
    - from: "**/shared/**"  # 解決後パスにマッチ
    - from: "lodash"        # 外部パッケージは指定子そのまま
```

## ルールの継承

親フォルダのルールは子フォルダに継承されます。子フォルダで定義したルールは親のルールとマージされます。

```
src/
├── zonefence.yaml         # 親ルール（scope.apply: descendants）
└── domain/
    └── zonefence.yaml     # 子ルール（親ルールを継承＋追加）
```

`scope.apply: self` を指定すると、そのルールは自フォルダのみに適用され、子フォルダには継承されません。

## エラー出力例

```
src/domain/user/UserService.ts
  12:1  error  Import from "axios" is not allowed  (import-boundary)
    Design intent: Domain層は外部依存を持たない純粋な層です
    Rule: src/domain/zonefence.yaml

✖ 1 error in 1 file
```

## CLI オプション

```bash
npx zonefence check [path] [options]
```

| オプション | 説明 |
|-----------|------|
| `-c, --config <path>` | tsconfig.jsonのパス |
| `--no-color` | カラー出力を無効化 |

## 開発

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm run build

# 開発モード（ウォッチ）
pnpm run dev

# lint
pnpm run lint

# 型チェック
pnpm run typecheck

# テスト
pnpm test
```

## ライセンス

MIT
