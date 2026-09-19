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
dynamic routes (`[id]`) and route groups (`(group)`) match as expected:

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

Calls whose specifier is not a string literal (a template literal or a variable) have
no specifier to match against and are skipped.

## Rule Inheritance

Parent folder rules are inherited by child folders. Rules defined in child folders are merged with parent rules.

```
src/
├── zonefence.yaml         # Parent rule (scope.apply: descendants)
└── domain/
    └── zonefence.yaml     # Child rule (inherits + extends parent)
```

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

Exit code is `1` when there is at least one violation, otherwise `0`.

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
      "moduleSpecifier": "hono",
      "message": "Core layer cannot depend on an HTTP framework",
      "rule": "import-boundary",
      "ruleFilePath": "src/core/zonefence.yaml",
      "designIntent": "Core layer - pure business logic"
    }
  ],
  "summary": { "errorCount": 1, "filesChecked": 4, "importsChecked": 12 }
}
```

`--reporter github` emits GitHub Actions error annotations, so violations show up on
the offending lines of a pull request:

```
::error file=src/core/Novel.ts,line=3,col=0,title=zonefence(import-boundary)::Core layer cannot depend on an HTTP framework
```

```yaml
# .github/workflows/zonefence.yml
- run: npx zonefence check ./src --reporter github
```

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
