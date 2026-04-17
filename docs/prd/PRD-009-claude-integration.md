# PRD-009: Claude Integration — Plugin + MCP Distribution

## Status: Draft
## Date: 2026-04-17
## Author: Robert

---

## Problem Statement

Lexius has a working compliance agent, API, and MCP server — but they're only accessible to developers who clone the repo and run the stack locally. The two largest audiences for AI regulatory compliance help — compliance officers and AI product teams — use Claude daily but have no way to connect it to Lexius's authoritative, provenance-tracked compliance database.

Two distribution channels exist for making tools available to Claude users:

1. **Claude.ai integrations** — hosted API endpoints that Claude.ai invokes on the user's behalf. Available to all Claude.ai users who enable the integration. Requires a publicly reachable API with OAuth/API-key auth, tool definitions in the Anthropic integrations format, and submission through Anthropic's integration program.

2. **MCP servers** — local or remote processes that Claude Desktop / Claude Code connect to via the Model Context Protocol. Self-hosted by the user or run via `npx`. No Anthropic approval required; the user configures their own `claude_desktop_config.json`.

Both channels should expose the same compliance tools with the same provenance-aware responses.

## Vision

A compliance officer opens Claude.ai, enables the "Lexius Compliance" integration, and asks: *"What are my obligations as a provider of a high-risk recruitment AI under the EU AI Act?"* Claude calls Lexius's hosted API, retrieves the 16 obligations (each labelled AUTHORITATIVE or CURATED), and presents them with article citations and provenance badges — no local setup required.

A developer working in Claude Code types `/mcp add lexius` (or configures manually), and their Claude session gains the same compliance tools — backed by their own Lexius instance or by the hosted API.

Both paths return identical, provenance-tagged, deterministic results.

## Users

| Persona | Channel | Need |
|---------|---------|------|
| **Compliance Officer** | Claude.ai plugin | Ask compliance questions in natural language; get provenance-tagged answers without installing anything |
| **Legal Counsel** | Claude.ai plugin | Verify specific article text, check penalty exposure, get deadline alerts |
| **AI Product Team** | Claude Code MCP | Integrate compliance checks into development workflow; query obligations while building |
| **Platform Operator** | Both | Offer Lexius as a service; track usage; manage API keys |
| **Developer** | MCP | Self-host against their own DB for internal compliance tooling |

## Product Requirements

### P0 — Must Have

#### Claude.ai Integration (Hosted)

1. **Hosted API deployment** — the existing `@lexius/api` Express server deployed to a public cloud (Railway, Render, or Vercel) with TLS, connected to a managed Postgres instance (Supabase, Neon, or Railway Postgres) pre-loaded with EU AI Act + DORA.
2. **Auth for Claude.ai** — API key auth on all `/api/v1/*` routes. Claude.ai sends the key in the `Authorization` header (or custom header per Anthropic's integration spec). Keys are per-user or per-organisation, stored hashed in a `api_keys` table.
3. **Integration manifest** — a JSON/YAML file conforming to Anthropic's integration schema (tool definitions, auth config, description, icon, categories). Maps the existing 11 MCP tools + 3 new provenance tools to the integration format.
4. **Tool definitions** — each tool's `input_schema` uses dynamic enums loaded from the DB at deploy time (same pattern as the agent's `loadAgentConfig`). Descriptions explicitly mention provenance tiers.
5. **Rate limiting** — per-key rate limits (100 req/min default) to protect the hosted instance. 429 responses with `Retry-After`.
6. **Response format** — every tool response includes a `_provenance` metadata block:
   ```json
   {
     "_provenance": {
       "source": "lexius",
       "version": "0.3.0",
       "dataAsOf": "2026-04-17T09:00:00Z",
       "legislationsAvailable": ["eu-ai-act", "dora"]
     },
     "result": { ... }
   }
   ```
7. **Health + status endpoint** — `GET /health` returns uptime, DB connectivity, legislation count, last fetch timestamp.
8. **Submission to Anthropic** — prepare all assets for the Anthropic integrations program: manifest, logo, description, category tags, example prompts, privacy policy URL, terms of service URL.

#### MCP Server Distribution

9. **Publishable `@lexius/mcp` package** — `npx @lexius/mcp` starts a stdio MCP server. Reads `DATABASE_URL` from env (self-hosted) or `LEXIUS_API_URL` + `LEXIUS_API_KEY` (connects to the hosted API as a proxy).
10. **Two modes** —
    - **Direct mode**: connects to a local/remote Postgres DB. Full functionality, requires the user to run migrations and seeds.
    - **Proxy mode**: connects to the hosted Lexius API over HTTPS. No DB required; the MCP server translates MCP tool calls into REST API calls. Limited to the tools the API exposes; no custom queries.
11. **Claude Desktop config** — documented `claude_desktop_config.json` snippet:
    ```json
    {
      "mcpServers": {
        "lexius": {
          "command": "npx",
          "args": ["@lexius/mcp"],
          "env": {
            "LEXIUS_API_URL": "https://api.lexius.ai",
            "LEXIUS_API_KEY": "lx_..."
          }
        }
      }
    }
    ```
12. **Claude Code registration** — `lexius mcp register` CLI command that writes the config to the user's Claude Code settings. Alternatively, manual instructions in README.
13. **Tool parity** — the MCP server exposes the same tools in both modes: `legalai_classify_system`, `legalai_get_obligations`, `legalai_calculate_penalty`, `legalai_search_knowledge`, `legalai_get_article`, `legalai_get_deadlines`, `legalai_answer_question`, `legalai_run_assessment`, `legalai_list_legislations`, `legalai_get_article_history`, `legalai_get_derivation_chain`, `legalai_get_article_extracts`.
14. **Provenance in MCP responses** — every tool result includes provenance tier on each entity, matching the API DTO format.

### P1 — Should Have

15. **Usage dashboard** — API key holders can see their usage (requests by tool, by day). Simple admin route or hosted dashboard.
16. **Multi-tenant API keys** — keys scoped to specific legislations (e.g., a key that only grants access to EU AI Act, not DORA).
17. **Webhook for regulation updates** — when the fetcher detects an article change (new source_hash), notify subscribed API keys via webhook.
18. **Claude.ai example prompts** — pre-authored prompts shown in the integration card: "Classify my AI system", "What are the penalties for...?", "When is the next compliance deadline?"
19. **OpenAPI spec** — auto-generated from the Express routes for documentation and SDK generation.

### P2 — Nice to Have

20. **Embeddable widget** — a `<script>` tag that embeds a Lexius chat widget on a customer's compliance portal, backed by the same API.
21. **SSO integration** — API key auth replaced by OAuth2 for enterprise customers.
22. **Legislation marketplace** — users can request new legislations; the operator adds them via fetcher and the tools automatically surface them.

## Out of Scope

- Building a custom UI or web app (Claude.ai IS the UI).
- Mobile app.
- Multi-language article text (English only for launch).
- Billing / payment processing (free tier or manual invoicing for launch).
- Training or fine-tuning a custom model (Lexius is tool-use, not model-based).
- Modifying Claude's behavior outside of tool results (no system prompt injection from the plugin side).

## Success Metrics

- A Claude.ai user with the integration enabled can ask "What are the penalties under the EU AI Act?" and receive a response citing Art. 99 with the exact EUR figures (35M / 15M / 7.5M) labelled AUTHORITATIVE — verified by comparing the response to the DB.
- An MCP user running `npx @lexius/mcp` in proxy mode can invoke all 12 tools from Claude Desktop and get provenance-tagged results.
- The hosted API handles 100 concurrent requests with p95 latency < 500ms (DB query time dominates; the API layer adds < 50ms).
- Zero AUTHORITATIVE facts in any response are invented by the LLM — every number, date, and article text comes from the DB, verified by spot-checking 20 random interactions.
- Integration submission accepted by Anthropic (timeline depends on their review process).

## Rollout

1. **Deploy hosted API** — Railway/Render, managed Postgres, seed + fetch + extract on deploy.
2. **Add API key auth** — `api_keys` table, middleware, key generation CLI.
3. **Write integration manifest** — tool definitions, auth config, metadata.
4. **Publish `@lexius/mcp`** to npm with proxy mode.
5. **Documentation** — README, Claude Desktop config, example prompts.
6. **Submit to Anthropic** — manifest + assets + test account.
7. **Launch** — announce availability on both channels.
