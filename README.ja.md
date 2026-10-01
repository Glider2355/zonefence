# zonefence

TypeScriptプロジェクト向けのフォルダ単位アーキテクチャ・ガードレール

[English README](./README.md)

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
    - from: "src/shared/**"  # 共有モジュールを許可
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
    - from: "src/shared/**"  # 共有モジュール
  deny:
    - from: "../infrastructure/**"
      message: "Domain層からInfrastructure層への依存は禁止"
  mode: allow-first  # デフォルト
```

未知のキーはエラーになります。`mesage:` のようなタイプミスは黙って無視されるのではなく、
該当ファイルとキー名を示して検証エラーになります。`reason` は `message` のエイリアスとして
受け付けます。

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
| `imports.allow[].from` / `imports.deny[].from` | マッチさせる import パターン | 必須 |
| `imports.allow[].message` / `imports.deny[].message` | 違反時に表示するメッセージ（エイリアス: `reason`） | - |
| `imports.allow[].kind` / `imports.deny[].kind` | ルールの対象とする import の種類: `type` / `value` / `any`（[型のみの import](#型のみの-import) を参照） | `any` |
| `files.allow` | 指定すると、いずれかのパターンにマッチするファイルだけが存在できる（[ファイル配置ルール](#ファイル配置ルール) を参照） | `[]` |
| `files.require` | 対になるファイルが必須のファイル | `[]` |

### 評価モード

#### `allow-first`（デフォルト）

1. `deny`ルールにマッチしたらエラー
2. `allow`ルールが定義されている場合、いずれかにマッチしなければエラー

#### `deny-first`

1. `allow`ルールにマッチしたら許可
2. `deny`ルールにマッチしたらエラー
3. どちらにもマッチしなければ許可

## パスのマッチング

zonefenceは**解決済みファイルパス**と**元のモジュール指定子**の両方でマッチングを行うため、使いやすい方を選べます。

### 解決済みパス

ローカルインポートは、プロジェクトルートからの解決済みファイルパスにマッチします。

```yaml
imports:
  allow:
    - from: "src/api/**"      # 解決後パスにマッチ
    - from: "src/shared/**"
```

### 相対パターン

`./` または `../` で始まるパターンは、**ルールを持つディレクトリ**（`directoryPatterns` の
場合はパターンがマッチしたディレクトリ）を基準に解決されます。import 元ファイルのディレクトリ
基準ではないため、1つのルールがそのディレクトリ配下のネストしたファイルにも一様に適用されます。

```
src/packages/novel/
├── core/
└── use-case/
    ├── zonefence.yaml      # allow: ["./**", "../core/**"]
    └── novel/
        └── NovelUseCase.ts # ../core/** から import できる
```

glob のメタ文字を含むディレクトリ名はリテラルとして扱われるため、Next.js の dynamic route
（`[id]`）や route group（`(group)`）も期待通りマッチします。解決されたディレクトリ側だけでなく、
パターンに直接書いた場合（`../../[otherId]/_components/**`）も同様です。セグメント全体が角括弧で
囲まれている場合はディレクトリ名として扱い、より大きなセグメントに埋め込まれた文字クラス
（`v[0-9]`）は glob として解釈されます。

```yaml
# src/zonefence.yaml
directoryPatterns:
  - pattern: "**/_containers"
    config:
      imports:
        allow:
          - from: "../_components/**"   # app/novel/[id]/_components/** にマッチ
          - from: "./**"
```

### 祖先パターン

`^/` で始まるパターンは、**import 元ファイルの任意の祖先ディレクトリ**を起点にします。
`^/_components/**` は、import 元ファイルのディレクトリからチェック対象のルートまでの各ディレクトリ
`A` について `A/_components/**` にマッチします。

「ページ私有のコードは、そのページ自身と配下のページからだけ import できる」というコロケーションの
ルールを表現できます。相対パターンでは表現できません（`../../**/_components/**` は兄弟ページにも
届いてしまいます）。

```yaml
# src/zonefence.yaml
directoryPatterns:
  - pattern: "**/_components"
    config:
      imports:
        allow:
          - from: "^/_components/**"
          - from: "^/_hooks/**"
          - from: "^/_lib/**"
```

```
app/novel/[id]/_components/Foo.tsx                            ← 祖先ページ
app/novel/[id]/chapter/[chapterId]/edit/_components/Bar.tsx   ← Foo を import してよい
app/novel/[id]/assets/_components/Baz.tsx                     ← Bar から Baz は NG（兄弟ページ）
```

### パスエイリアス

パターンでパスエイリアスを直接使用することもできます。`@/` のようなTypeScriptパスエイリアスを使用しているコードベースで便利です。

```yaml
imports:
  allow:
    - from: "@/api/**"        # モジュール指定子 @/api/helpers/errorHandler にマッチ
    - from: "@/shared/**"
```

### ワークスペースパッケージ

モノレポのワークスペースパッケージには、パッケージ名パターンを使用します。

```yaml
imports:
  allow:
    - from: "@myorg/shared"   # 特定のパッケージ
    - from: "@myorg/*"        # @myorgスコープの全パッケージ
```

### 外部パッケージ

外部npmパッケージはモジュール指定子でマッチングします。

```yaml
imports:
  allow:
    - from: "lodash"          # 特定のパッケージ
    - from: "@types/*"        # 全ての@typesパッケージ
  deny:
    - from: "axios"
      message: "fetchを使用してください"
```

### 動的 import

静的な `import` / `export ... from` に加えて、動的 `import("...")` と `require("...")` も
検査対象です。

```ts
const { getCloudflareContext } = await import("@opennextjs/cloudflare"); // 検査される
const Heavy = dynamic(() => import("@/app/foo/_components/Heavy"));      // 検査される
const fs = require("node:fs");                                          // 検査される
```

引数が文字列リテラルでない呼び出し（式を埋め込んだテンプレートリテラルや変数）は、マッチ対象と
なる指定子が存在しません。import ルールのあるディレクトリ内では **warning** として報告されます
（チェックは失敗しません）。`--strict` を付けると error になります。

```
src/core/loader.ts
  4:8  warning  Cannot check import(`./${name}.js`): the specifier is not a string literal  (dynamic-import)
```

### 型のみの import

ルールに `kind` を付けると、型参照と値参照で許可を変えられます。たとえば「use-case は gateway の
**型**（port の interface）だけ見てよく、実装には依存しない」:

```yaml
imports:
  allow:
    - from: "./**"
    - from: "../gateway/**"
      kind: type      # import type { X } / import { type X } のみ許可
  deny:
    - from: "../gateway/**"
      kind: value
      message: "use-case は gateway の実装に依存しない"
```

| `kind` | 対象 |
|--------|------|
| `type` | `import type { X }`、`import { type X, type Y }`（全ての束縛が型）、`export type { X } from`、`export { type X } from`、`import type x = require()`、型位置の `import("...").X` |
| `value` | 上記以外。副作用 import、`export * from`、動的 `import()`、`require()`、`import x = require()` を含む |
| `any`（デフォルト） | 両方 |

## ファイル配置ルール

import に加えて、フォルダに「あってよいファイル / なければならないファイル」も検査できます。

```yaml
# src/api/routes/zonefence.yaml
version: 1
files:
  allow:                       # ここに置けるファイル名はこれだけ
    - "route.ts"
    - "handler.ts"
    - "index.ts"
    - "*Dto.ts"
    - "*.test.ts"
  require:
    - for: "**/*.test.ts"      # テストは対象ファイルと同じディレクトリに置く
      sibling: "{stem}.{ts,tsx}"
```

```yaml
# src/zonefence.yaml — directoryPatterns でも使えます
directoryPatterns:
  - pattern: "components/ui"
    config:
      files:
        require:
          - for: "**/*.tsx"
            sibling: "{name}.stories.tsx"
            exclude: ["**/*.test.tsx", "**/*.stories.tsx", "**/*Icon.tsx"]
            message: "components/ui のコンポーネントは Storybook 必須"
```

| オプション | 説明 |
|-----------|------|
| `files.allow` | glob パターン。1件以上あると、全てのファイルがいずれかにマッチする必要がある |
| `files.require[].for` | 対になるファイルが必要なファイルを選ぶ glob |
| `files.require[].sibling` | 同じディレクトリに必要なファイル名。glob として解釈され、下記のプレースホルダが使える |
| `files.require[].exclude` | この要件から除外するファイルの glob |
| `files.require[].message` | 対になるファイルがないときに表示するメッセージ |

`sibling` のプレースホルダ（ファイル名が `Button.test.tsx` の場合）:

| プレースホルダ | 値 |
|---------------|-----|
| `{name}` | `Button.test` — 最後の拡張子を除いたファイル名 |
| `{stem}` | `Button` — 最初のドットまでのファイル名 |
| `{ext}` | `tsx` — 最後の拡張子 |

パターンは、ルールが適用されるディレクトリからの相対パスに対してマッチします。スラッシュを含まない
パターンはファイル名単体にもマッチするので、`route.ts` はネストしたディレクトリでも有効です。
拡張子を問わず全てのファイルが対象ですが、ドットファイルと `zonefence.yaml` 自体は除きます。
`scope.exclude` は通常どおり適用されます。

ファイル配置ルールも import ルールと同様に継承されます。継承されたパターンのうちパスを含むものは、
書かれたディレクトリからの相対のままです。`src/zonefence.yaml` の `routes/**/route.ts` は、
`src/` 配下のどのディレクトリに対しても `src/routes/**/route.ts` を指します。

## ルールの継承

親フォルダのルールは子フォルダに継承されます。子フォルダで定義したルールは親のルールとマージされます。

```
src/
├── zonefence.yaml         # 親ルール（scope.apply: descendants）
└── domain/
    └── zonefence.yaml     # 子ルール（親ルールを継承＋追加）
```

継承された相対パターンは、書かれた場所を基準にしたままです。`src/zonefence.yaml` に書いた
`./shared/**` は、`src/domain/` 配下のファイルに対しても `src/shared/**` を指します。`files` のパターンも同様です。

`scope.apply: self` を指定すると、そのルールは自フォルダのみに適用され、子フォルダには継承されません。

## ディレクトリパターン（コロケーション対応）

ページごとに `containers/`、`presenters/` などのディレクトリを配置するコロケーションパターンを使用している場合、`directoryPatterns` を定義することで、`zonefence.yaml` を各ディレクトリに重複して配置せずにルールを自動適用できます。

### ディレクトリ構造の例

```
src/
├── pages/
│   ├── zonefence.yaml      ← ここにdirectoryPatternsを定義
│   ├── home/
│   │   ├── containers/     ← パターンマッチ（pagesのスコープ内）
│   │   └── presenters/     ← パターンマッチ
│   └── settings/
│       ├── containers/     ← パターンマッチ
│       └── presenters/     ← パターンマッチ
└── api/
    └── containers/         ← マッチしない（pagesのスコープ外）
```

### 設定例

```yaml
# src/pages/zonefence.yaml
version: 1
description: "Pages層のルール"

directoryPatterns:
  - pattern: "**/containers"
    config:
      description: "Container層"
      imports:
        allow:
          - from: "../presenters/**"
          - from: "../hooks/**"
        deny:
          - from: "../containers/**"
            message: "Containerは兄弟Containerからimportしてはいけません"

  - pattern: "**/presenters"
    config:
      imports:
        allow:
          - from: "./**"
          - from: "@/ui/**"
        deny:
          - from: "../containers/**"
            message: "PresenterはContainerからimportしてはいけません"

scope:
  exclude:
    - "**/*.test.tsx"
```

### パターンオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `pattern` | マッチするディレクトリのglobパターン（zonefence.yamlの位置からの相対パス） | 必須 |
| `config.description` | マッチしたディレクトリの説明 | - |
| `config.files` | マッチしたディレクトリに適用するファイル配置ルール | - |
| `config.imports` | マッチしたディレクトリのimportルール | - |
| `config.mergeStrategy` | `"merge"`（他のルールと結合）または `"override"`（置換） | `"merge"` |
| `priority` | 複数パターンがマッチした場合、優先度が高い方が先に適用される | `0` |

### パターン書式

| パターン | マッチ例（`pages/zonefence.yaml`から） |
|---------|---------------------------------------|
| `**/containers` | `pages/home/containers`, `pages/settings/containers`, `pages/a/b/containers` |
| `*/presenters` | `pages/home/presenters`（直下の子のみ） |
| `home/containers` | `pages/home/containers`（完全一致） |

### 優先順位

複数のルールがディレクトリに適用される場合：

1. **ディレクトリ固有の `zonefence.yaml`**（最優先）
2. **パターンルール**（`priority`値順、次に具体性順）
3. **親ディレクトリからの継承**（最低優先）

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
| `--reporter <name>` | 出力形式: `console`（デフォルト）/ `json` / `github` |
| `--strict` | warning を error として扱う |

error が1件以上あれば終了コードは `1`、なければ `0` です。warning だけではチェックは失敗しません。

### レポーター

`--reporter json` は構造化されたレポートを stdout に出力します。パスは実行ディレクトリからの
相対パスです。

```json
{
  "violations": [
    {
      "file": "src/core/Novel.ts",
      "line": 3,
      "column": 0,
      "severity": "error",
      "moduleSpecifier": "hono",
      "message": "Core層はHTTPフレームワークに依存できません",
      "rule": "import-boundary",
      "ruleFilePath": "src/core/zonefence.yaml",
      "designIntent": "Core層 - 純粋なビジネスロジック"
    }
  ],
  "summary": { "errorCount": 1, "warningCount": 0, "filesChecked": 4, "importsChecked": 12 }
}
```

`rule` は `import-boundary` / `file-placement` / `dynamic-import` のいずれかです。
`moduleSpecifier` は import の違反にのみ含まれます。

`--reporter github` は GitHub Actions のアノテーション（`::error` / `::warning`）を出力するため、
違反が PR の該当行に表示されます。

```
::error file=src/core/Novel.ts,line=3,col=1,title=zonefence(import-boundary)::Core層はHTTPフレームワークに依存できません
```

```yaml
# .github/workflows/zonefence.yml
- run: npx zonefence check ./src --reporter github
```

アノテーションのパスはリポジトリルート（`GITHUB_WORKSPACE`）からの相対パスになるため、monorepo の
パッケージディレクトリで実行した場合も該当行に表示されます。

## ドキュメント生成

`zonefence docs` はルールファイルを Markdown の表として出力します。設計ルールの文書を、実際に
検査されている内容から生成するので、文書と `zonefence.yaml` が乖離しません。

```bash
npx zonefence docs ./src --out docs/architecture.md --lang ja
```

| オプション | 説明 |
|-----------|------|
| `-o, --out <file>` | ファイルに書き出す（省略時は stdout に出力） |
| `--lang <lang>` | 見出しの言語: `en`（デフォルト）/ `ja` |

```markdown
| ディレクトリ | 設計意図 | 許可 | 禁止（理由） |
| --- | --- | --- | --- |
| `src/packages/novel/core` | Core層 - 純粋なビジネスロジック | `@/packages/novel/core/**`, `neverthrow` | `hono`（Core層はHTTPフレームワークに依存できません） |
| `src/pages/**/containers` | Container層 | `../presenters/**` | `../containers/**`（兄弟の containers からは import できません） |
```

`zonefence.yaml` のあるディレクトリごとに1行、`directoryPatterns` はパターンごとに1行です。
ルールは書かれたとおりに表示されます（継承は展開しません）。ファイル配置ルールがある場合は
「ファイル」列が追加されます。

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
