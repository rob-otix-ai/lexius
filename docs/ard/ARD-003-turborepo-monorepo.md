# ARD-003: Turborepo Monorepo with pnpm Workspaces

## Status: Accepted
## Date: 2026-04-15

---

## Context

The platform consists of multiple packages (db, core, api, mcp, cli, agent) plus skills and documentation. These packages share types, have build-time dependencies, and must be developed, tested, and deployed cohesively.

## Decision

Use Turborepo with pnpm workspaces.

### Workspace Structure

```
legal-ai/
├── packages/
│   ├── db/              # Drizzle schema, migrations, seed scripts
│   │   ├── src/
│   │   │   ├── schema/          # Drizzle table definitions
│   │   │   ├── migrations/      # Generated migrations
│   │   │   ├── seeds/           # Seed data per legislation
│   │   │   │   └── eu-ai-act/   # EU AI Act seed files
│   │   │   └── index.ts         # Exports: schema, connection factory
│   │   └── package.json
│   │
│   ├── core/            # Domain + application layers
│   │   ├── src/
│   │   │   ├── domain/          # Entities, value objects, ports
│   │   │   ├── use-cases/       # Application use cases
│   │   │   ├── legislation/     # Legislation plugins
│   │   │   │   └── eu-ai-act/   # EU AI Act plugin
│   │   │   └── index.ts         # Public API exports
│   │   └── package.json
│   │
│   ├── api/             # Express HTTP server
│   │   ├── src/
│   │   │   ├── routes/          # Express route handlers
│   │   │   ├── middleware/      # Auth, validation, error handling
│   │   │   └── index.ts         # Server bootstrap
│   │   └── package.json
│   │
│   ├── mcp/             # MCP server (stdio + HTTP)
│   │   ├── src/
│   │   │   ├── tools/           # MCP tool definitions
│   │   │   ├── resources/       # MCP resource definitions
│   │   │   └── index.ts         # Server bootstrap
│   │   └── package.json
│   │
│   ├── cli/             # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/        # CLI command handlers
│   │   │   └── index.ts         # CLI entry point
│   │   └── package.json
│   │
│   └── agent/           # Claude Agent SDK agent
│       ├── src/
│       │   ├── tools/           # Agent tool definitions
│       │   └── index.ts         # Agent entry point
│       └── package.json
│
├── skills/              # Claude Code skill definitions
│   └── eu-ai-act.md
│
├── seeds/               # Raw regulation source text
│   └── eu-ai-act/       # Curated markdown/JSON source files
│
├── .specflow/           # Specflow contracts and config
│   └── contracts/
│
├── docs/
│   ├── prd/
│   ├── ard/
│   └── ddd/
│
├── docker-compose.yml   # Postgres + pgvector
├── turbo.json           # Pipeline configuration
├── pnpm-workspace.yaml  # Workspace definition
├── package.json         # Root scripts
└── tsconfig.base.json   # Shared TypeScript config
```

### Turborepo Pipeline

```jsonc
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "enforce": {
      "cache": false      // specflow enforce, always fresh
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "dependsOn": ["db:migrate"],
      "cache": false
    }
  }
}
```

### Dependency Graph

```
db ← core ← api
              ├── mcp
              ├── cli
              └── agent
```

- `core` depends on `db` (for schema types, not for runtime connections)
- All consumers depend on `core`
- No consumer depends on another consumer

## Consequences

### Positive

- Shared types without publishing to npm during development
- Turborepo caches builds — only rebuilds what changed
- Single `pnpm install` and `turbo build` for the whole project
- Consistent tooling (TypeScript config, ESLint, Prettier) across packages
- `turbo run test --filter=core` runs only core tests

### Negative

- Initial setup overhead vs a single package
- Must be disciplined about package boundaries (specflow enforces this)

## Alternatives Considered

1. **Nx** — more features but heavier; Turborepo is simpler for our scale
2. **Separate repos** — rejected; shared types become a publishing nightmare
3. **Single package with barrel exports** — rejected; no build isolation, blurred boundaries
