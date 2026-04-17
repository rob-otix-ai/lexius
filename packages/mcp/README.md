# @robotixai/lexius-mcp

MCP server for the [Lexius](https://github.com/rob-otix-ai/lexius) AI compliance platform. Connect Claude Desktop, Claude Code, or any MCP client to a provenance-tracked regulatory compliance database covering the EU AI Act and DORA.

## Quick Start

```bash
# Proxy mode — connect to a hosted Lexius API (no database required)
LEXIUS_API_URL=https://your-lexius-instance.example.com LEXIUS_API_KEY=lx_... npx @robotixai/lexius-mcp

# Direct mode — connect to your own Postgres
DATABASE_URL=postgresql://user:pass@localhost:5432/legal_ai npx @robotixai/lexius-mcp
```

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lexius": {
      "command": "npx",
      "args": ["@robotixai/lexius-mcp"],
      "env": {
        "LEXIUS_API_URL": "https://your-lexius-instance.example.com",
        "LEXIUS_API_KEY": "lx_your_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `legalai_classify_system` | Classify an AI system under a legislation's risk framework |
| `legalai_get_obligations` | Get compliance obligations by role, risk level, legislation |
| `legalai_calculate_penalty` | Calculate penalty exposure for a violation type |
| `legalai_get_article` | Retrieve verbatim article text (AUTHORITATIVE from EUR-Lex) |
| `legalai_get_deadlines` | List compliance deadlines |
| `legalai_search_knowledge` | Semantic search across articles, obligations, FAQ |
| `legalai_answer_question` | Answer compliance questions using the FAQ knowledge base |
| `legalai_run_assessment` | Run structured compliance assessments |
| `legalai_list_legislations` | List available legislations |
| `legalai_get_article_history` | View article revision history |
| `legalai_get_derivation_chain` | Trace an obligation back to its source articles |
| `legalai_get_article_extracts` | View deterministically-extracted facts (fines, dates, cross-refs) |
| `legalai_run_swarm_assessment` | Run a parallel hivemind assessment across all articles |

## Provenance

Every response includes a provenance tier:

- **AUTHORITATIVE** — verbatim from official regulation text (EUR-Lex CELLAR)
- **CURATED** — written or reviewed by a domain expert
- **AI_GENERATED** — model output, flagged for review

## Modes

### Proxy Mode
Set `LEXIUS_API_URL` and `LEXIUS_API_KEY`. The MCP server translates tool calls into HTTP requests to the hosted API. No database required.

### Direct Mode
Set `DATABASE_URL`. The MCP server connects directly to a Postgres database with the Lexius schema.

The easiest way to get a ready-made database is with our Docker image — schema and all 5 migrations are applied automatically on first start:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=secret robotixai/lexius-db
```

Then point the MCP server at it:

```bash
DATABASE_URL=postgresql://legal_ai:secret@localhost:5432/legal_ai npx @robotixai/lexius-mcp
```

See the [main repo](https://github.com/rob-otix-ai/lexius) for seeding data and fetching verbatim regulation text.

If both are set, direct mode takes precedence.

## Legislations Supported

- **EU AI Act** (Regulation 2024/1689) — 113 articles + 13 annexes
- **DORA** (Regulation 2022/2554) — 64 articles

## Links

- [GitHub Repository](https://github.com/rob-otix-ai/lexius)
- [CLI Package](https://www.npmjs.com/package/@robotixai/lexius-cli)
- [Report Issues](https://github.com/rob-otix-ai/lexius/issues)

## License

MIT
