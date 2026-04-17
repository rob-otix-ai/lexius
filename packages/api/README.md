# @robotixai/lexius-api

REST API + SSE MCP server for the [Lexius](https://github.com/rob-otix-ai/lexius) AI compliance platform. 15 endpoints covering risk classification, obligations, penalties, deadlines, semantic search, audit reports, article extracts, derivation chains, and hivemind swarm assessment.

## Quick Start

```bash
# 1. Start the database
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -e POSTGRES_USER=$POSTGRES_USER \
  robotixai/lexius-db

# 2. Start the API
DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB \
npx @robotixai/lexius-api
```

The API starts on port 3000 (override with `PORT` env var).

## Endpoints

```
POST /api/v1/classify                     Risk classification
GET  /api/v1/obligations                  Obligations by role/risk
POST /api/v1/penalties/calculate          Penalty calculation
GET  /api/v1/articles/:number             Verbatim article text
GET  /api/v1/articles/:id/history         Article revisions
GET  /api/v1/articles/:id/extracts        Extracted facts
GET  /api/v1/deadlines                    Compliance deadlines
GET  /api/v1/obligations/:id/derivation   Source article trace
POST /api/v1/knowledge/search             Semantic search
POST /api/v1/faq/search                   FAQ search
GET  /api/v1/legislations                 Available legislations
POST /api/v1/audit                        Full compliance report
POST /api/v1/swarm/run                    Hivemind swarm assessment
GET  /api/v1/swarm/:sessionId/findings    Swarm workspace
POST /api/v1/swarm/:sessionId/synthesise  Report from swarm
GET  /health                              DB stats + uptime
GET  /mcp/sse                             Remote MCP via SSE
```

## Auth

All `/api/v1/*` routes require `Authorization: Bearer lx_...` (API key auth). Create keys with `scripts/create-api-key.ts`. Health and manifest endpoints are unauthenticated.

## Provenance

Every response includes `_provenance` metadata and per-entity provenance tiers (AUTHORITATIVE / CURATED / AI_GENERATED).

## Links

- [GitHub](https://github.com/rob-otix-ai/lexius)
- [MCP Server](https://www.npmjs.com/package/@robotixai/lexius-mcp)
- [CLI](https://www.npmjs.com/package/@robotixai/lexius-cli)
- [Agent](https://www.npmjs.com/package/@robotixai/lexius-agent)
- [Docker Hub](https://hub.docker.com/r/robotixai/lexius-api)

## License

MIT
