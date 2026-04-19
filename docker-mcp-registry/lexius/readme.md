# Lexius Compliance MCP Server

AI regulatory compliance database with provenance-tracked obligations, penalties, deadlines, and verbatim regulation text.

## What it does

Lexius gives Claude access to a structured compliance database covering **10 EU regulations**: GDPR, EU AI Act, DORA, Digital Services Act, Digital Markets Act, Data Act, Data Governance Act, Cyber Resilience Act, MiCA, and eIDAS 2.0. Every fact is tagged with a provenance tier:

- **AUTHORITATIVE** — verbatim from the official regulation text (EUR-Lex CELLAR), SHA-256 hash-verified
- **CURATED** — written or reviewed by a domain expert, with attribution
- **AI_GENERATED** — model output, flagged for review

## Tools (13)

| Tool | What it does |
|------|-------------|
| `legalai_classify_system` | Classify an AI system's risk level |
| `legalai_get_obligations` | Get compliance obligations by role/risk |
| `legalai_calculate_penalty` | Calculate fine exposure |
| `legalai_get_article` | Retrieve verbatim article text |
| `legalai_get_deadlines` | Compliance deadlines with days remaining |
| `legalai_search_knowledge` | Semantic search across all content |
| `legalai_answer_question` | FAQ lookup |
| `legalai_run_assessment` | Structured assessments (Art. 6(3), GPAI) |
| `legalai_list_legislations` | Available legislations |
| `legalai_get_article_history` | Article revision history |
| `legalai_get_derivation_chain` | Trace obligation to source articles |
| `legalai_get_article_extracts` | Extracted facts (fines, dates, cross-refs) |
| `legalai_run_swarm_assessment` | Parallel hivemind compliance assessment |

## Modes

### Direct Mode (own database)

Connect to a PostgreSQL database with the Lexius schema. Use the `robotixai/lexius-db` Docker image for a pre-configured database:

```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -e POSTGRES_USER=$POSTGRES_USER \
  robotixai/lexius-db
```

Then configure the MCP server with `DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@host.docker.internal:5432/$POSTGRES_DB`.

### Proxy Mode (hosted API)

Connect to a hosted Lexius API. No database required. Configure with `LEXIUS_API_URL` and `LEXIUS_API_KEY`.

## Data

- **806 articles** across 10 EU regulations, all AUTHORITATIVE
- **6,923 extracted facts** (fine amounts, percentages, dates, cross-references, shall-clauses)
- **61 curated obligations** (35 EU AI Act + 26 DORA)
- **5 penalty tiers** with CI-verified amounts
- **44 FAQ entries** with semantic search

## Links

- [GitHub](https://github.com/rob-otix-ai/lexius)
- [npm: @robotixai/lexius-mcp](https://www.npmjs.com/package/@robotixai/lexius-mcp)
- [Docker Hub: robotixai/lexius-mcp](https://hub.docker.com/r/robotixai/lexius-mcp)
