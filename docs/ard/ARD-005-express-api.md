# ARD-005: Express as the HTTP API Framework

## Status: Accepted
## Date: 2026-04-15

---

## Context

The platform needs an HTTP API layer to expose core compliance operations. Multiple consumers (MCP, CLI, Skills, Agent, future web UI) need programmatic access. The API must be a thin layer — all business logic lives in the core package.

## Decision

Use Express.js (v5) with TypeScript.

### Route Structure

```
POST   /api/v1/classify              # Classify an AI system
GET    /api/v1/deadlines             # Get implementation milestones
GET    /api/v1/obligations           # Filter by legislation, role, risk level
POST   /api/v1/faq/search           # Semantic FAQ search
POST   /api/v1/penalties/calculate   # Calculate max fines
GET    /api/v1/articles/:number      # Retrieve article by number
POST   /api/v1/gpai/systemic-risk   # GPAI systemic risk check
POST   /api/v1/assessments/:id      # Run legislation-specific assessment
GET    /api/v1/annex-iv/checklist   # Annex IV documentation checklist
GET    /api/v1/legislations          # List available legislations
```

All routes scoped under `/api/v1` with `legislation` as a query parameter (defaults to `eu-ai-act`).

### Middleware Stack

1. **Input validation** — Zod schemas (shared with core) validate request bodies
2. **Error handling** — centralised error handler maps domain errors to HTTP status codes
3. **Request logging** — structured JSON logs
4. **CORS** — configurable origins for future web clients

### Architecture Role

The API layer is infrastructure. Route handlers:

1. Parse and validate input (Zod)
2. Call the appropriate use case from core
3. Map the result to an HTTP response

No business logic, no direct database access, no embedding calls.

## Consequences

### Positive

- Mature ecosystem, extensive middleware library
- Team familiarity — widely known framework
- Express v5 has native async error handling
- Simple to test with supertest

### Negative

- Not as lightweight as Hono or Fastify
- No built-in typed routes (mitigated by Zod + TypeScript)

## Alternatives Considered

1. **Hono** — lighter, typed routes, edge-ready. Rejected: team prefers Express, edge deployment not needed
2. **Fastify** — faster benchmarks, schema validation built in. Viable but Express is more familiar
3. **tRPC** — type-safe RPC. Rejected: we need REST for non-TypeScript consumers
