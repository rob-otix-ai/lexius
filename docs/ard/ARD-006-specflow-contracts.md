# ARD-006: Specflow Contract Enforcement

## Status: Accepted
## Date: 2026-04-15

---

## Context

Clean architecture depends on discipline — developers (and LLMs) must respect layer boundaries, dependency direction, and the legislation plugin model. Convention alone isn't enough; the lexbeam reference implementation mixes data, logic, and transport in a single layer. We need mechanical enforcement.

## Decision

Use [specflow-cli](https://github.com/fall-development-rob/specflow-cli) for YAML-based contract enforcement across the monorepo.

### Contract Categories

**Architecture (ARCH-*):**
- Domain layer imports nothing from infrastructure or application
- Use cases import only from domain (entities, ports)
- Infrastructure implements domain ports
- Legislation plugins export only through the `LegislationPlugin` interface
- No cross-package imports except through each package's public `index.ts`

**Security (SEC-*):**
- No hardcoded credentials, tokens, or connection strings
- All SQL via Drizzle ORM (parameterised by default)
- API input validated with Zod on every endpoint
- No `eval()`, `Function()`, or dynamic code execution

**Quality (QA-*):**
- No `any` type in domain layer
- Every use case has a test file
- Seed data has validation tests
- Exports are explicit (no `export *` from domain)

### Enforcement Points

| Trigger | Command | Blocks |
|---------|---------|--------|
| Pre-commit hook | `specflow enforce .` | Commit |
| CI pipeline | `specflow enforce .` | Merge |
| Claude Code hook | `specflow enforce .` | Tool execution (optional) |
| Manual | `specflow status .` | Nothing (dashboard only) |

### Integration with Turborepo

```jsonc
// turbo.json
{
  "pipeline": {
    "enforce": {
      "cache": false,
      "dependsOn": ["build"]
    }
  }
}
```

`pnpm turbo enforce` runs specflow against the built output.

### Contract Location

```
.specflow/
├── contracts/
│   ├── arch-clean-layers.yaml
│   ├── arch-legislation-plugins.yaml
│   ├── arch-package-boundaries.yaml
│   ├── sec-credentials.yaml
│   ├── sec-sql-safety.yaml
│   ├── sec-input-validation.yaml
│   ├── qa-domain-types.yaml
│   ├── qa-test-coverage.yaml
│   └── qa-seed-validation.yaml
├── config.json
└── knowledge/
```

## Consequences

### Positive

- Architectural violations caught before they reach the repo
- Contracts are readable YAML, reviewable in PRs
- Knowledge graph tracks compliance trends over time
- LLM-driven development stays within bounds
- New developers (and agents) get immediate feedback on violations

### Negative

- Adds a pre-commit step (~3-5 seconds)
- Contract maintenance as the codebase evolves
- Learning curve for writing custom contracts

### Mitigations

- Start with the contracts listed above; add more as patterns emerge
- Specflow's `doctor` command validates contract health
- Specflow's MCP integration allows querying contracts from within Claude Code
