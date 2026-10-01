# zonefence

Folder-based architecture guardrails for TypeScript projects.

[日本語版 README](./README.ja.md)

## Installation

```bash
npm install -D zonefence
# or
pnpm add -D zonefence
```

## Usage

### Create a rule file

Create a `zonefence.yaml` file in any folder you want to protect:

```yaml
version: 1

description: "Domain layer - pure business logic with no external dependencies"

imports:
  allow:
    - from: "./**"           # Allow imports from the same folder
    - from: "src/shared/**"    # Allow shared modules
  deny:
    - from: "axios"
      message: "Domain layer should not depend on external HTTP libraries"
    - from: "../infrastructure/**"
      message: "Domain layer cannot depend on Infrastructure layer"
```

### Run the check

```bash
npx zonefence check ./src
```

## Rule Schema

```yaml
version: 1

description: "Description of this folder's design intent"

scope:
  apply: descendants  # "self" | "descendants"
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"

imports:
  allow:
    - from: "./**"           # Same folder
    - from: "src/shared/**"    # Shared modules
  deny:
    - from: "../infrastructure/**"
      message: "Domain layer cannot depend on Infrastructure layer"
  mode: allow-first  # default
```

Unknown keys are rejected, so a typo (`mesage:`) fails validation with the offending
file and key instead of being silently ignored. `reason` is accepted as an alias of
`message`.

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `version` | Schema version (currently only 1) | Required |
| `description` | Description of the folder's design intent | - |
| `scope.apply` | Rule scope (`self`: this folder only, `descendants`: also applies to child folders) | `descendants` |
| `scope.exclude` | File patterns to exclude from checking | `[]` |
| `imports.allow` | List of allowed import patterns | `[]` |
| `imports.deny` | List of denied import patterns | `[]` |
| `imports.mode` | Evaluation mode (`allow-first`: allow list priority, `deny-first`: deny list priority) | `allow-first` |
| `imports.allow[].from` / `imports.deny[].from` | Import pattern to match | Required |
| `imports.allow[].message` / `imports.deny[].message` | Message shown when the rule is violated (alias: `reason`) | - |
| `imports.allow[].kind` / `imports.deny[].kind` | Which imports the rule applies to: `type`, `value` or `any` (see [Type-only Imports](#type-only-imports)) | `any` |
| `files.allow` | When set, only files matching one of these patterns may exist (see [File Placement Rules](#file-placement-rules)) | `[]` |
| `files.require` | Files that must have a sibling file | `[]` |

### Evaluation Modes

#### `allow-first` (default)

1. If import matches a `deny` rule, error
2. If `allow` rules are defined, import must match at least one, otherwise error

#### `deny-first`

1. If import matches an `allow` rule, allow
2. If import matches a `deny` rule, error
3. If import matches neither, allow

## Path Matching

zonefence matches imports against both the **resolved file path** and the **original module specifier**, so you can use whichever is more convenient.

### Resolved Paths

Local imports are matched against the resolved file path relative to the project root.

```yaml
imports:
  allow:
    - from: "src/api/**"      # Matches resolved path
    - from: "src/shared/**"
```

### Relative Patterns

Patterns starting with `./` or `../` are resolved against **the directory that owns the
rule** — for `directoryPatterns`, the directory the pattern matched — not against the
directory of the importing file. This means one rule applies uniformly to files nested
inside that directory:

```
src/packages/novel/
├── core/
└── use-case/
    ├── zonefence.yaml      # allow: ["./**", "../core/**"]
    └── novel/
        └── NovelUseCase.ts # may import from ../core/**
```

Directory names containing glob metacharacters are handled literally, so Next.js
dynamic routes (`[id]`) and route groups (`(group)`) match as expected — both when
they come from the resolved directory and when you write them into the pattern
(`../../[otherId]/_components/**`). A segment that is entirely bracketed is treated as
a directory name; a character class embedded in a larger segment (`v[0-9]`) keeps its
glob meaning.

```yaml
# src/zonefence.yaml
directoryPatterns:
  - pattern: "**/_containers"
    config:
      imports:
        allow:
          - from: "../_components/**"   # matches app/novel/[id]/_components/**
          - from: "./**"
```

### Ancestor Patterns

A pattern starting with `^/` is anchored at **any ancestor directory of the importing
file**: `^/_components/**` matches `A/_components/**` for every directory `A` from the
file's own directory up to the checked root.

This expresses the colocation rule "private code may only be imported by its own page
and the pages below it", which relative patterns cannot (`../../**/_components/**` also
reaches into sibling pages):

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
app/novel/[id]/_components/Foo.tsx                            ← ancestor page
app/novel/[id]/chapter/[chapterId]/edit/_components/Bar.tsx   ← may import Foo
app/novel/[id]/assets/_components/Baz.tsx                     ← Bar may NOT import Baz (sibling page)
```

### Path Aliases

You can also use path aliases directly in patterns. This is useful when your codebase uses TypeScript path aliases like `@/`.

```yaml
imports:
  allow:
    - from: "@/api/**"        # Matches module specifier @/api/helpers/errorHandler
    - from: "@/shared/**"
```

### Workspace Packages

For monorepo workspace packages, use the package name pattern:

```yaml
imports:
  allow:
    - from: "@myorg/shared"   # Exact package
    - from: "@myorg/*"        # All packages in @myorg scope
```

### External Packages

External npm packages are matched against the module specifier.

```yaml
imports:
  allow:
    - from: "lodash"          # Exact package
    - from: "@types/*"        # All @types packages
  deny:
    - from: "axios"
      message: "Use fetch instead"
```

### Dynamic Imports

Static `import` / `export ... from`, dynamic `import("...")`, and `require("...")` are
all checked:

```ts
const { getCloudflareContext } = await import("@opennextjs/cloudflare"); // checked
const Heavy = dynamic(() => import("@/app/foo/_components/Heavy"));      // checked
const fs = require("node:fs");                                          // checked
```

Calls whose specifier is not a string literal (a template literal with substitutions or
a variable) have no specifier to match against. Inside a directory with import rules
they are reported as a **warning**, which does not fail the check; pass `--strict` to
make them errors.

```
src/core/loader.ts
  4:8  warning  Cannot check import(`./${name}.js`): the specifier is not a string literal  (dynamic-import)
```

### Type-only Imports

Add `kind` to a rule to treat type references and value references differently — for
example "a use case may see the gateway's *types* (the port interface), but not its
implementation":

```yaml
imports:
  allow:
    - from: "./**"
    - from: "../gateway/**"
      kind: type      # import type { X } / import { type X } only
  deny:
    - from: "../gateway/**"
      kind: value
      message: "Use cases must not depend on gateway implementations"
```

| `kind` | Matches |
|--------|---------|
| `type` | `import type { X }`, `import { type X, type Y }` (every binding is a type), `export type { X } from`, `export { type X } from`, `import type x = require()`, type-level `import("...").X` |
| `value` | Everything else, including side-effect imports, `export * from`, dynamic `import()`, `require()` and `import x = require()` |
| `any` (default) | Both |

## File Placement Rules

Besides imports, a rule can constrain which files a folder may or must contain.

```yaml
# src/api/routes/zonefence.yaml
version: 1
files:
  allow:                       # only these file names may exist here
    - "route.ts"
    - "handler.ts"
    - "index.ts"
    - "*Dto.ts"
    - "*.test.ts"
  require:
    - for: "**/*.test.ts"      # a test must sit next to the file it tests
      sibling: "{stem}.{ts,tsx}"
```

```yaml
# src/zonefence.yaml — works in directoryPatterns too
directoryPatterns:
  - pattern: "components/ui"
    config:
      files:
        require:
          - for: "**/*.tsx"
            sibling: "{name}.stories.tsx"
            exclude: ["**/*.test.tsx", "**/*.stories.tsx", "**/*Icon.tsx"]
            message: "UI components must have a Storybook story"
```

| Option | Description |
|--------|-------------|
| `files.allow` | Glob patterns. When non-empty, every file must match at least one |
| `files.require[].for` | Glob selecting the files that need a sibling |
| `files.require[].sibling` | File name the sibling must have, in the same directory. A glob, with the placeholders below |
| `files.require[].exclude` | Globs for files exempt from the requirement |
| `files.require[].message` | Message shown when the sibling is missing |

Placeholders in `sibling`, for a file named `Button.test.tsx`:

| Placeholder | Value |
|-------------|-------|
| `{name}` | `Button.test` — the file name without its last extension |
| `{stem}` | `Button` — the file name up to the first dot |
| `{ext}` | `tsx` — the last extension |

Patterns are matched against the path relative to the directory the rule applies to; a
pattern without a slash also matches the bare file name, so `route.ts` applies in nested
directories too. All files are checked regardless of extension, except dotfiles and
`zonefence.yaml` itself; `scope.exclude` applies as usual.

File rules are inherited like import rules. An inherited pattern that contains a path
stays relative to the directory it was written in: `routes/**/route.ts` in
`src/zonefence.yaml` means `src/routes/**/route.ts` for every directory below `src/`.

## Rule Inheritance

Parent folder rules are inherited by child folders. Rules defined in child folders are merged with parent rules.

```
src/
├── zonefence.yaml         # Parent rule (scope.apply: descendants)
└── domain/
    └── zonefence.yaml     # Child rule (inherits + extends parent)
```

An inherited relative pattern keeps pointing at the same place: `./shared/**` written in
`src/zonefence.yaml` still means `src/shared/**` for the files under `src/domain/`. The same holds for
`files` patterns.

With `scope.apply: self`, the rule applies only to the current folder and is not inherited by child folders.

## Directory Patterns (Colocation Support)

For projects using colocation patterns (e.g., `containers/`, `presenters/` directories under each page), you can define `directoryPatterns` to apply rules automatically to matching directories without duplicating `zonefence.yaml` files.

### Example Structure

```
src/
├── pages/
│   ├── zonefence.yaml      ← Define directoryPatterns here
│   ├── home/
│   │   ├── containers/     ← Pattern matches (within pages scope)
│   │   └── presenters/     ← Pattern matches
│   └── settings/
│       ├── containers/     ← Pattern matches
│       └── presenters/     ← Pattern matches
└── api/
    └── containers/         ← Does NOT match (outside pages scope)
```

### Configuration

```yaml
# src/pages/zonefence.yaml
version: 1
description: "Pages layer rules"

directoryPatterns:
  - pattern: "**/containers"
    config:
      description: "Container layer"
      imports:
        allow:
          - from: "../presenters/**"
          - from: "../hooks/**"
        deny:
          - from: "../containers/**"
            message: "Containers should not import from sibling containers"

  - pattern: "**/presenters"
    config:
      imports:
        allow:
          - from: "./**"
          - from: "@/ui/**"
        deny:
          - from: "../containers/**"
            message: "Presenters should not import from containers"

scope:
  exclude:
    - "**/*.test.tsx"
```

### Pattern Options

| Option | Description | Default |
|--------|-------------|---------|
| `pattern` | Glob pattern to match directories (relative to the zonefence.yaml location) | Required |
| `config.description` | Description for matched directories | - |
| `config.imports` | Import rules for matched directories | - |
| `config.files` | File placement rules for matched directories | - |
| `config.mergeStrategy` | `"merge"` (combine with other rules) or `"override"` (replace) | `"merge"` |
| `priority` | Higher priority patterns are applied first (when multiple patterns match) | `0` |

### Pattern Syntax

| Pattern | Matches (from `pages/zonefence.yaml`) |
|---------|---------------------------------------|
| `**/containers` | `pages/home/containers`, `pages/settings/containers`, `pages/a/b/containers` |
| `*/presenters` | `pages/home/presenters` (direct children only) |
| `home/containers` | `pages/home/containers` (exact path) |

### Priority Order

When multiple rules apply to a directory:

1. **Directory's own `zonefence.yaml`** (highest priority)
2. **Pattern rules** (sorted by `priority` value, then by specificity)
3. **Parent directory inheritance** (lowest priority)

## Error Output Example

```
src/domain/user/UserService.ts
  12:1  error  Import from "axios" is not allowed  (import-boundary)
    Design intent: Domain layer is a pure layer with no external dependencies
    Rule: src/domain/zonefence.yaml

✖ 1 error in 1 file
```

## CLI Options

```bash
npx zonefence check [path] [options]
```

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to tsconfig.json |
| `--no-color` | Disable colored output |
| `--reporter <name>` | Output format: `console` (default), `json`, `github` |
| `--strict` | Treat warnings as errors |

Exit code is `1` when there is at least one error, otherwise `0`. Warnings alone do not
fail the check.

### Reporters

`--reporter json` prints a structured report on stdout, with paths relative to the
working directory:

```json
{
  "violations": [
    {
      "file": "src/core/Novel.ts",
      "line": 3,
      "column": 0,
      "severity": "error",
      "moduleSpecifier": "hono",
      "message": "Core layer cannot depend on an HTTP framework",
      "rule": "import-boundary",
      "ruleFilePath": "src/core/zonefence.yaml",
      "designIntent": "Core layer - pure business logic"
    }
  ],
  "summary": { "errorCount": 1, "warningCount": 0, "filesChecked": 4, "importsChecked": 12 }
}
```

`rule` is `import-boundary`, `file-placement` or `dynamic-import`; `moduleSpecifier` is
present for import violations only.

`--reporter github` emits GitHub Actions annotations (`::error` / `::warning`), so
violations show up on the offending lines of a pull request:

```
::error file=src/core/Novel.ts,line=3,col=1,title=zonefence(import-boundary)::Core layer cannot depend on an HTTP framework
```

```yaml
# .github/workflows/zonefence.yml
- run: npx zonefence check ./src --reporter github
```

Annotation paths are relative to the repository root (`GITHUB_WORKSPACE`), so they also
line up when the check runs from a package directory of a monorepo.

## Generating Documentation

`zonefence docs` renders the rule files as a Markdown table, so the written architecture
guide is generated from what is actually enforced and cannot drift from it.

```bash
npx zonefence docs ./src --out docs/architecture.md
```

| Option | Description |
|--------|-------------|
| `-o, --out <file>` | Write to a file (printed to stdout when omitted) |
| `--lang <lang>` | Language of the headings: `en` (default), `ja` |

```markdown
| Directory | Design intent | Allowed | Denied (reason) |
| --- | --- | --- | --- |
| `src/packages/novel/core` | Core layer - pure business logic | `@/packages/novel/core/**`, `neverthrow` | `hono` (Core cannot depend on an HTTP framework) |
| `src/pages/**/containers` | Container layer | `../presenters/**` | `../containers/**` (Containers should not import from sibling containers) |
```

There is one row per directory with a `zonefence.yaml` and one per `directoryPatterns`
entry, showing the rules as written (inheritance is not expanded). A `Files` column is
added when any rule constrains files.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Development mode (watch)
pnpm run dev

# Lint
pnpm run lint

# Type check
pnpm run typecheck

# Test
pnpm test
```

## License

MIT
