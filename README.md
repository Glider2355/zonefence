# zonefence

Folder-based architecture guardrails for TypeScript projects.

## Installation

```bash
npm install -D zonefence
```

## Usage

### Create a rule file

Create a `.zonefence.yaml` file in any folder you want to protect:

```yaml
version: 1

description: "Domain layer - no external dependencies allowed"

imports:
  allow:
    - from: "./**"
    - from: "@/shared/**"
  deny:
    - from: "axios"
      message: "Domain layer should not depend on external HTTP libraries"
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
    - from: "@/shared/**"    # Shared modules
  deny:
    - from: "../infrastructure/**"
      message: "Domain layer cannot depend on Infrastructure layer"
  mode: allow-first  # default
```

## License

MIT
