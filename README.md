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

### Evaluation Modes

#### `allow-first` (default)

1. If import matches a `deny` rule, error
2. If `allow` rules are defined, import must match at least one, otherwise error

#### `deny-first`

1. If import matches an `allow` rule, allow
2. If import matches a `deny` rule, error
3. If import matches neither, allow

## Path Matching

### Resolved Paths

Local imports are matched against the **resolved file path** relative to the project root, not the module specifier written in the code.

For example, if your import is `@/api/helpers/errorHandler` and it resolves to `src/api/helpers/errorHandler.ts`, the rule pattern should use the actual path:

```yaml
imports:
  deny:
    # ❌ Path aliases are NOT supported in patterns
    # - from: "@/api/**"

    # ✅ Use actual file paths
    - from: "src/api/**"
```

### External Packages

Modules that cannot be resolved (external packages) are matched against the original module specifier.

```yaml
imports:
  allow:
    - from: "src/shared/**"  # Matches resolved path
    - from: "lodash"         # External packages match the specifier as-is
```

## Rule Inheritance

Parent folder rules are inherited by child folders. Rules defined in child folders are merged with parent rules.

```
src/
├── zonefence.yaml         # Parent rule (scope.apply: descendants)
└── domain/
    └── zonefence.yaml     # Child rule (inherits + extends parent)
```

With `scope.apply: self`, the rule applies only to the current folder and is not inherited by child folders.

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
