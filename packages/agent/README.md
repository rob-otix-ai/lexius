# @robotixai/lexius-agent

Interactive AI compliance consultant for the [Lexius](https://github.com/rob-otix-ai/lexius) platform. Powered by Claude with deterministic tool use — every factual claim comes from the database, not the model's training data.

## Quick Start

```bash
# 1. Start a ready-made database (schema auto-applied)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=secret robotixai/lexius-db

# 2. Run the agent
export DATABASE_URL=postgresql://legal_ai:secret@localhost:5432/legal_ai
export ANTHROPIC_API_KEY=sk-ant-...
npx @robotixai/lexius-agent
```

## What It Does

Ask compliance questions in natural language. The agent routes to deterministic tools, retrieves provenance-tagged answers, and presents them with article citations:

- Classifies your AI system under the EU AI Act risk framework
- Lists your obligations by role (provider/deployer) and risk level
- Calculates penalty exposure with SME rules
- Retrieves verbatim article text from the regulation
- Checks compliance deadlines
- Runs structured assessments (Art. 6(3) exception, GPAI systemic risk)
- Generates full audit reports

## Determinism

The agent is configured for maximum reproducibility:

- **temperature: 0** on all API calls
- **DB-loaded enums** — tool schemas use exact valid values from the database, not hardcoded lists
- **Provenance on every claim** — responses distinguish AUTHORITATIVE (verbatim law) from CURATED (expert interpretation) from AI_GENERATED
- **No fallback to training data** — if a tool call fails, the agent reports the failure; it does not guess

## Tools Available

| Tool | Description | Source |
|------|-------------|--------|
| `classify_system` | Risk classification | DB (deterministic) |
| `get_obligations` | Obligations by role/risk | DB |
| `calculate_penalty` | Penalty calculation | DB + extracted values |
| `get_article` | Verbatim article text | CELLAR (AUTHORITATIVE) |
| `get_deadlines` | Compliance deadlines | DB |
| `search_knowledge` | Semantic search | DB + embeddings |
| `answer_question` | FAQ lookup | DB |
| `run_assessment` | Structured assessments | DB (plugin rules) |
| `list_legislations` | Available legislations | DB |

## Hivemind Swarm

The agent package also includes the hivemind swarm — parallel compliance analysis across all articles:

```typescript
import { runSwarm, synthesise, cleanupSession } from '@robotixai/lexius-agent';

const result = await runSwarm(db, 'eu-ai-act', { concurrency: 4 });
const report = await synthesise(db, result.sessionId, metadata);
await cleanupSession(db, result.sessionId);
```

1,882 findings in ~2.6s. Fully deterministic — no LLM in the agent loop.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Model override (default: `claude-sonnet-4-6`) |
| `OPENAI_API_KEY` | No | For embeddings in semantic search |

## Links

- [GitHub Repository](https://github.com/rob-otix-ai/lexius)
- [MCP Server](https://www.npmjs.com/package/@robotixai/lexius-mcp)
- [CLI](https://www.npmjs.com/package/@robotixai/lexius-cli)
- [Report Issues](https://github.com/rob-otix-ai/lexius/issues)

## License

MIT
