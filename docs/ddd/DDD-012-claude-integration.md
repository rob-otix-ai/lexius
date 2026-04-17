# DDD-012: Claude Integration — Implementation

## Status: Draft
## Date: 2026-04-17

---

## Overview

Implementation details for PRD-009 / ARD-013. Covers: API key auth, hosted deployment, MCP proxy mode, SSE transport, integration manifest generation, npm publishing, and the Specflow contract.

## Schema Changes

### `api_keys` table

```typescript
// packages/db/src/schema/api-keys.ts
import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  rateLimit: integer("rate_limit").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});
```

Migration: `0003_api_keys.sql`. Simple CREATE TABLE; no triggers, no CHECK constraints beyond the unique hash.

### Migration SQL (`0003_api_keys.sql`)

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id            serial PRIMARY KEY,
  key_hash      varchar(64) NOT NULL UNIQUE,
  key_prefix    varchar(12) NOT NULL,
  owner_email   text NOT NULL,
  name          text NOT NULL,
  scopes        text[] NOT NULL DEFAULT '{}',
  rate_limit    integer NOT NULL DEFAULT 100,
  created_at    timestamp NOT NULL DEFAULT now(),
  last_used_at  timestamp,
  revoked_at    timestamp
);

CREATE INDEX api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX api_keys_owner_email_idx ON api_keys (owner_email);
```

## API Key Auth

### Key generation

```typescript
// packages/api/src/auth/api-key.ts
import { randomBytes, createHash } from "node:crypto";

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `lx_${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}
```

### CLI command

```bash
lexius api-key create --email user@company.com --name "Production Key"
# Outputs: lx_a1b2c3d4...  (printed once, never stored in cleartext)
```

Added to `packages/cli/src/index.ts` or a new `scripts/create-api-key.ts`.

### Middleware update

The existing `apiKeyAuth` middleware in `packages/api/src/middleware/` is updated:

```typescript
export function apiKeyAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer lx_")) {
      // Fall back to x-api-key header for backward compat
      const xApiKey = req.headers["x-api-key"];
      if (!xApiKey) {
        return res.status(401).json({ error: "Missing API key" });
      }
      // ... existing x-api-key logic
    }

    const key = authHeader.slice(7); // strip "Bearer "
    const hash = createHash("sha256").update(key).digest("hex");
    const [row] = await db.select().from(apiKeys)
      .where(eq(apiKeys.keyHash, hash));

    if (!row || row.revokedAt) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }

    // Update last_used_at (fire-and-forget)
    db.update(apiKeys).set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.id)).catch(() => {});

    // Attach key info to request for rate limiting
    (req as any).apiKeyId = row.id;
    (req as any).apiKeyRateLimit = row.rateLimit;
    next();
  };
}
```

### Rate limiting

The existing `rateLimiter` middleware switches from a global window to per-key windows when `req.apiKeyId` is present. Uses an in-memory store (good for single-instance; switch to Redis for multi-instance).

## MCP Proxy Mode

### Mode detection in `packages/mcp/src/setup.ts`

```typescript
export async function setupMcp() {
  if (process.env.DATABASE_URL) {
    // Direct mode — connect to Postgres
    const { container, pool } = infraSetup();
    return { container, cleanup: () => pool.end() };
  }

  if (process.env.LEXIUS_API_URL && process.env.LEXIUS_API_KEY) {
    // Proxy mode — create a container backed by HTTP calls
    const container = createProxyContainer(
      process.env.LEXIUS_API_URL,
      process.env.LEXIUS_API_KEY,
    );
    return { container, cleanup: async () => {} };
  }

  throw new Error(
    "Set DATABASE_URL for direct mode, or LEXIUS_API_URL + LEXIUS_API_KEY for proxy mode",
  );
}
```

### Proxy container

```typescript
// packages/mcp/src/proxy-container.ts
export function createProxyContainer(baseUrl: string, apiKey: string) {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  async function get(path: string): Promise<unknown> {
    const res = await fetch(`${baseUrl}/api/v1${path}`, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
    return res.json();
  }

  // Return an object matching the Container interface
  // Each "use case" delegates to an API call
  return {
    classifySystem: { execute: (input: any) => post("/classify", input) },
    getObligations: { execute: (input: any) => get(`/obligations?legislationId=${input.legislationId}&role=${input.role ?? ""}&riskLevel=${input.riskLevel ?? ""}`) },
    calculatePenalty: { execute: (input: any) => post("/penalties/calculate", input) },
    searchKnowledge: { execute: (input: any) => post("/search", input) },
    getArticle: { execute: (lid: string, num: string) => get(`/articles/${num}?legislationId=${lid}`) },
    getDeadlines: { execute: (lid: string) => get(`/deadlines?legislationId=${lid}`) },
    answerQuestion: { execute: (lid: string, q: string) => post("/faq/answer", { legislationId: lid, question: q }) },
    runAssessment: { execute: (lid: string, aid: string, input: any) => post("/assessments/run", { legislationId: lid, assessmentId: aid, input }) },
    listLegislations: { execute: () => get("/legislations") },
    getArticleHistory: { execute: (id: string) => get(`/articles/${id}/history`) },
    getDerivationChain: { execute: (id: string) => get(`/obligations/${id}/derivation`) },
    getArticleExtracts: { execute: (id: string, type?: string) => get(`/articles/${id}/extracts${type ? `?type=${type}` : ""}`) },
    // Repos not needed in proxy mode — tools use the methods above
    penaltyRepo: { findByLegislation: (lid: string) => get(`/penalties?legislationId=${lid}`) },
    deadlineRepo: {},
    pluginRegistry: {},
  };
}
```

### npm bin entry

```json
// packages/mcp/package.json additions
{
  "bin": {
    "lexius-mcp": "./dist/index.js"
  },
  "files": ["dist", "README.md"],
  "publishConfig": {
    "access": "public"
  }
}
```

`packages/mcp/src/index.ts` gains a `#!/usr/bin/env node` shebang.

## SSE Transport for Hosted MCP

The MCP SDK supports `SSEServerTransport`. The API server mounts it:

```typescript
// packages/api/src/mcp-sse.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerTools } from "@lexius/mcp";

export function mountMcpSse(app: Express, container: Container) {
  const server = new McpServer({ name: "lexius", version: "0.3.0" });
  registerTools(server, container);

  app.get("/mcp/sse", async (req, res) => {
    const transport = new SSEServerTransport("/mcp/messages", res);
    await server.connect(transport);
  });

  app.post("/mcp/messages", async (req, res) => {
    // SSEServerTransport handles message routing
    await transport.handlePostMessage(req, res);
  });
}
```

Claude.ai can connect to `https://api.lexius.ai/mcp/sse` as a remote MCP server. Auth: same `Bearer lx_...` API key in the SSE request headers.

## Integration Manifest

Generated by `scripts/generate-manifest.ts`:

```typescript
// scripts/generate-manifest.ts
import { setup } from "@lexius/infra";
import { loadAgentConfig } from "@lexius/agent";

async function main() {
  const { container, pool } = setup();
  const config = await loadAgentConfig(container);

  const manifest = {
    schema_version: "1",
    name: "Lexius Compliance",
    description: "AI regulatory compliance database with provenance-tracked obligations, penalties, deadlines, and verbatim regulation text for EU AI Act and DORA.",
    auth: {
      type: "api_key",
      header: "Authorization",
      prefix: "Bearer ",
    },
    base_url: process.env.LEXIUS_API_URL || "https://api.lexius.ai",
    tools: buildToolDefinitions(config),
    metadata: {
      categories: ["legal", "compliance", "regulation", "ai-governance"],
      icon_url: "https://api.lexius.ai/icon.png",
      privacy_policy_url: "https://lexius.ai/privacy",
      terms_url: "https://lexius.ai/terms",
      example_prompts: [
        "Classify my AI recruitment system under the EU AI Act",
        "What penalties does a provider face for high-risk non-compliance?",
        "What are the upcoming EU AI Act deadlines?",
        "Show me the verbatim text of Article 9",
        "What fines are extracted from Article 99?",
      ],
    },
  };

  console.log(JSON.stringify(manifest, null, 2));
  await pool.end();
}

main();
```

The manifest is served at `GET /integration-manifest.json` on the hosted API and committed to the repo as `integration-manifest.json`.

## Deployment

### Dockerfile (root-level, for the hosted API)

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app
RUN corepack enable
COPY --from=builder /app .
EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
```

### Railway config (`railway.toml`)

```toml
[build]
  builder = "dockerfile"

[deploy]
  healthcheckPath = "/health"
  healthcheckTimeout = 30
  restartPolicyType = "on_failure"

[[deploy.hooks]]
  command = "pnpm --filter @lexius/db exec drizzle-kit migrate && node packages/fetcher/dist/cli.js ingest --celex 32024R1689 --legislation eu-ai-act && node packages/fetcher/dist/cli.js ingest --celex 32022R2554 --legislation dora"
  when = "deploy"
```

### Environment variables (Railway)

```
DATABASE_URL=<neon connection string>
OPENAI_API_KEY=<for embeddings>
ANTHROPIC_API_KEY=<for agent, if agent routes are exposed>
PORT=3000
```

## Testing Strategy

### Unit
- `generateApiKey()`: key format, hash determinism, prefix extraction
- Proxy container: mock HTTP, verify route mapping for each tool
- Rate limiter: per-key windowing

### Integration
- API key auth: create key → call API → 200; revoke key → call API → 401
- MCP proxy mode: start server with `LEXIUS_API_URL` → invoke tool → verify HTTP call was made with correct path + headers
- MCP direct mode: start server with `DATABASE_URL` → invoke tool → verify DB query

### E2E
- Claude Desktop config: start `npx @lexius/mcp` in proxy mode → invoke `legalai_list_legislations` via MCP client → assert response includes `eu-ai-act`
- Hosted API: deploy to Railway staging → call `/api/v1/obligations?legislationId=eu-ai-act` with valid key → assert response includes provenance

## Rollout Order

1. `api_keys` schema + migration + auth middleware update + CLI key generation.
2. `_provenance` metadata block on all API responses.
3. MCP proxy mode (`proxy-container.ts`, mode detection in `setup.ts`).
4. SSE transport mount on the API server.
5. Integration manifest generation script + served at `/integration-manifest.json`.
6. Dockerfile + Railway config + Neon Postgres setup.
7. Deploy staging → smoke test all 12 tools via both channels.
8. Publish `@lexius/mcp` to npm.
9. Write Claude Desktop + Claude Code config documentation.
10. Submit integration manifest to Anthropic.

## Specflow Contract (lands with implementation)

The `integration_security.yml` contract enforces:

```yaml
contract_meta:
  id: integration_security
  version: 1
  created_from_spec: "PRD-009 / ARD-013 / DDD-012 — Claude integration security invariants"
  covers_reqs:
    - INTEG-001
    - INTEG-002
    - INTEG-003
  owner: "legal-ai-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: integration_security"

rules:
  non_negotiable:
    - id: INTEG-001
      title: "API key hashes must never appear in tool responses"
      scope:
        - "packages/api/src/routes/**/*.{ts,js}"
        - "packages/mcp/src/tools/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /keyHash|key_hash/
            message: "API key hashes must never be included in response payloads"

    - id: INTEG-002
      title: "MCP proxy mode must not expose DATABASE_URL"
      scope:
        - "packages/mcp/src/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /DATABASE_URL[\s\S]{0,50}(res\.json|JSON\.stringify|content:)/
            message: "DATABASE_URL must never be included in MCP tool responses or error messages"

    - id: INTEG-003
      title: "Hosted API responses must include _provenance metadata"
      scope:
        - "packages/api/src/routes/**/*.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /_provenance|provenance/
            message: "All API responses for provenance-bearing resources must include provenance metadata"
```

## Open Questions

- Anthropic's integration submission process and timeline — not public as of this writing; we build to the spec we know and adapt to their requirements during review.
- Whether Claude.ai supports remote MCP (SSE) or only the integration manifest — build both; one will be the right channel.
- Pricing for the hosted API — deferred; launch as free tier with rate limits.
- Custom domain (`api.lexius.ai`) — configure after Railway deploy.
