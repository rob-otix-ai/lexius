# ARD-013: Claude Integration Architecture

## Status: Accepted
## Date: 2026-04-17

---

## Context

PRD-009 specifies two distribution channels: a Claude.ai hosted integration and a distributable MCP server. Both must expose the same 12 compliance tools with provenance-tagged responses. The architecture must handle auth, deployment, the MCP proxy pattern, and tool-schema generation from the DB.

## Decision

### 1. Single API, two access layers

The existing `@lexius/api` Express server is the single source of truth. Both channels talk to it:

```
Claude.ai → HTTPS → @lexius/api (hosted) → Postgres
Claude Desktop → stdio → @lexius/mcp (proxy mode) → HTTPS → @lexius/api (hosted) → Postgres
Claude Desktop → stdio → @lexius/mcp (direct mode) → Postgres
```

No separate "plugin backend." The API is the plugin backend — it already exposes all the use cases through RESTful routes with provenance DTOs. The integration manifest points directly at its endpoints.

Rejected: building a separate plugin service. Adds a deployment, a codebase, and a sync problem with no benefit.

### 2. Deployment on Railway (primary) with Neon Postgres

Railway for the API container: simple Dockerfile deploy from the monorepo, auto-TLS, `PORT` env var, persistent Postgres via Neon (serverless Postgres with pgvector support). Why this pair:

- Railway: Git-push deploys, built-in health checks, auto-scaling, free tier for prototyping.
- Neon: serverless Postgres with pgvector extension pre-installed, branching for staging, connection pooling.

The deploy pipeline:
1. Push to `main` → Railway builds the Docker image from `packages/api/Dockerfile` (or a root Dockerfile that builds the workspace).
2. Post-deploy hook: run migrations (`drizzle-kit migrate`), then fetch + extract (`lexius-fetch ingest` for each CELEX).
3. Health check: `GET /health` returns 200 with DB connectivity + legislation count.

Rejected alternatives:
- **Vercel**: Express on Vercel requires serverless adapter; Postgres cold-start latency is higher; pgvector support is limited.
- **Supabase**: good Postgres but the API layer would still need a separate host.
- **Self-managed VPS**: operational burden, no auto-TLS, no auto-deploy.

### 3. API key auth on a new `api_keys` table

```sql
CREATE TABLE api_keys (
  id            serial PRIMARY KEY,
  key_hash      varchar(64) NOT NULL UNIQUE,
  key_prefix    varchar(8) NOT NULL,
  owner_email   text NOT NULL,
  name          text NOT NULL,
  scopes        text[] NOT NULL DEFAULT '{}',
  rate_limit    integer NOT NULL DEFAULT 100,
  created_at    timestamp NOT NULL DEFAULT now(),
  last_used_at  timestamp,
  revoked_at    timestamp
);
```

Keys are formatted `lx_<32 random hex>`. Stored as SHA-256 hash; only the prefix (`lx_xxxxxxxx`) is stored in cleartext for identification. The existing `apiKeyAuth` middleware in `packages/api/src/middleware/` is extended to look up the hash, check `revoked_at IS NULL`, and enforce per-key `rate_limit`.

A CLI command `lexius api-key create --email X --name Y` generates and prints the key once (it's never stored in cleartext).

Claude.ai sends the key as `Authorization: Bearer lx_...` per the integration spec.

Rejected alternatives:
- **OAuth2**: full OAuth is overkill for API-key-based tool access. Add later (P2) for enterprise SSO.
- **Session tokens**: stateful, harder to manage. API keys are stateless after lookup.
- **No auth (public)**: the DB contains proprietary analysis (curated obligations, FAQ). Auth is required.

### 4. Integration manifest maps existing routes to Anthropic tool definitions

The Anthropic integrations program requires a manifest (JSON) describing:
- Tool name, description, input schema (JSON Schema)
- Auth method (API key, header name)
- Base URL
- Metadata (name, description, icon, categories, example prompts)

We generate this from the DB at deploy time — same `loadAgentConfig()` function produces the enum values, and a script `scripts/generate-manifest.ts` writes the `integration-manifest.json`. The manifest is served at `GET /integration-manifest.json` and also committed to the repo.

Tool definitions match the MCP tool definitions 1:1, with the addition of HTTP routing info (`path`, `method`, `requestBody` mapping). Each tool maps to a single API route.

### 5. MCP proxy mode: stdio → HTTP translation

In proxy mode, `@lexius/mcp` starts as a stdio MCP server (same as today) but instead of querying Postgres directly, it translates each MCP tool call into an HTTP request to the hosted API:

```typescript
// Proxy-mode tool handler
async function proxyToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  const route = TOOL_ROUTE_MAP[toolName];
  const response = await fetch(`${LEXIUS_API_URL}/api/v1${route.path}`, {
    method: route.method,
    headers: {
      "Authorization": `Bearer ${LEXIUS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return response.text();
}
```

The `TOOL_ROUTE_MAP` maps each MCP tool name to an API route + method:

| MCP Tool | HTTP Route | Method |
|----------|-----------|--------|
| `legalai_classify_system` | `/classify` | POST |
| `legalai_get_obligations` | `/obligations` | GET |
| `legalai_calculate_penalty` | `/penalties/calculate` | POST |
| `legalai_get_article` | `/articles/:number` | GET |
| `legalai_get_deadlines` | `/deadlines` | GET |
| `legalai_get_article_history` | `/articles/:id/history` | GET |
| `legalai_get_article_extracts` | `/articles/:id/extracts` | GET |
| `legalai_get_derivation_chain` | `/obligations/:id/derivation` | GET |
| `legalai_search_knowledge` | `/search` | POST |
| `legalai_answer_question` | `/faq/answer` | POST |
| `legalai_list_legislations` | `/legislations` | GET |
| `legalai_run_assessment` | `/assessments/run` | POST |

Mode selection: if `DATABASE_URL` is set, direct mode. If `LEXIUS_API_URL` is set, proxy mode. If both, direct takes precedence. If neither, error with instructions.

Rejected: separate npm package for proxy. The mode switch is ~50 lines in the existing MCP setup; no new package needed.

### 6. MCP HTTP transport (SSE) for remote hosting

In addition to stdio (for `npx`), the MCP server supports **SSE transport** for remote hosting — this allows Claude.ai to connect to the MCP server directly over HTTPS without the user running a local process. The MCP SDK supports this via `SSEServerTransport`.

This is the cleanest path for the Claude.ai integration: rather than mapping MCP tools to REST routes via a manifest, the hosted API exposes the MCP server over SSE, and Claude.ai connects as an MCP client.

The API gains two new routes:
- `GET /mcp/sse` — SSE endpoint for the MCP client connection
- `POST /mcp/messages` — message endpoint for MCP client-to-server messages

Both routes use the same API key auth as the REST routes.

### 7. `_provenance` metadata block on all responses

Every API response (and therefore every MCP proxy response) includes a top-level `_provenance` metadata block:

```json
{
  "_provenance": {
    "source": "lexius",
    "version": "0.3.0",
    "dataAsOf": "2026-04-17T09:00:00Z",
    "legislationsAvailable": ["eu-ai-act", "dora"],
    "articleCount": 190,
    "extractCount": 1634
  },
  "result": { ... }
}
```

This gives the LLM and the user transparency into what data backs the response. The `dataAsOf` timestamp is the most recent `fetched_at` across all articles.

### 8. npm publishing for `@lexius/mcp`

The MCP package is published to npm as `@lexius/mcp`. The `bin` field in `package.json` registers `lexius-mcp` as the CLI command. `npx @lexius/mcp` starts the server.

Required `package.json` additions:
```json
{
  "bin": {
    "lexius-mcp": "./dist/index.js"
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  }
}
```

The package includes both direct and proxy modes. Users who just want to connect to the hosted service configure `LEXIUS_API_URL` + `LEXIUS_API_KEY` and don't need Postgres.

### 9. Security boundary

- API keys are never returned in tool responses.
- The MCP server in proxy mode does not expose the `DATABASE_URL` in any error message.
- Rate limiting is enforced server-side per API key; the MCP proxy respects 429 and surfaces the error to the user.
- No PII is stored — the API logs request metadata (key prefix, tool name, timestamp) but not request bodies.
- HTTPS-only for the hosted API. The MCP stdio mode is local and doesn't need TLS.

## Consequences

### Positive

- Lexius becomes accessible to every Claude.ai user without any local setup.
- MCP distribution lets developers self-host with their own DB for sensitive internal use.
- Single API codebase serves both channels — no sync drift.
- Provenance metadata flows through both channels, so the LLM can always report trust levels.

### Negative

- Hosted API has operational cost (Railway + Neon) even if no one is using it.
- API key management is a new responsibility (revocation, rotation, audit).
- The proxy-mode MCP server adds network latency (user → stdio → HTTP → DB → back).
- Anthropic's integration review timeline is unknown and not in our control.

### Mitigations

- Railway free tier covers prototyping; scale costs only when usage materialises.
- API key lifecycle is simple (create, revoke, rotate) — no OAuth flows.
- Proxy latency is acceptable for compliance queries (not latency-sensitive).
- MCP distribution is independent of the integration review — it ships immediately.
