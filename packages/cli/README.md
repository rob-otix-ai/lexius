# @robotixai/lexius-cli

Command-line interface for the [Lexius](https://github.com/rob-otix-ai/lexius) AI compliance platform. Query EU AI Act and DORA obligations, penalties, deadlines, and articles directly from your terminal.

## Quick Start

```bash
# Requires DATABASE_URL pointing to a Lexius Postgres instance
export DATABASE_URL=postgresql://user:pass@localhost:5432/legal_ai

# List available legislations
npx @robotixai/lexius-cli legislations

# Classify an AI system
npx @robotixai/lexius-cli classify \
  --legislation eu-ai-act \
  --description "AI recruitment screening system" \
  --role provider

# Get provider obligations for high-risk systems
npx @robotixai/lexius-cli obligations \
  --legislation eu-ai-act \
  --role provider \
  --risk-level high-risk

# Calculate penalty exposure
npx @robotixai/lexius-cli penalty \
  --legislation eu-ai-act \
  --violation high-risk-non-compliance \
  --turnover 500000000

# Look up verbatim article text
npx @robotixai/lexius-cli article 99 --legislation eu-ai-act

# Check compliance deadlines
npx @robotixai/lexius-cli deadlines --legislation eu-ai-act

# Semantic search
npx @robotixai/lexius-cli search "risk management" \
  --legislation eu-ai-act \
  --type obligation

# Generate a full compliance audit report
npx @robotixai/lexius-cli audit \
  --legislation eu-ai-act \
  --description "AI recruitment screening system" \
  --role provider
```

## Commands

| Command | Description |
|---------|-------------|
| `legislations` | List all available legislations |
| `classify` | Classify an AI system under a risk framework |
| `obligations` | List compliance obligations by role/risk level |
| `penalty` | Calculate penalty for a violation type |
| `article <number>` | Retrieve a specific article by number |
| `deadlines` | List compliance deadlines |
| `search <query>` | Semantic search across the knowledge base |
| `assess <id>` | Run a structured compliance assessment |
| `audit` | Generate a full compliance assessment report |

## Output Formats

All commands output JSON by default. Use `--format table` for tabular output where supported.

## Provenance

Every result includes a provenance tier indicating its source:

- **AUTHORITATIVE** — verbatim from official regulation text
- **CURATED** — expert-reviewed compliance interpretation
- **AI_GENERATED** — model output, flagged for review

## Requirements

- Node.js 18+
- A running Lexius Postgres database with migrations applied and data seeded/fetched

For database setup, see the [main repository](https://github.com/rob-otix-ai/lexius).

## Legislations Supported

- **EU AI Act** (Regulation 2024/1689) — 113 articles + 13 annexes, 35 obligations, 3 penalty tiers
- **DORA** (Regulation 2022/2554) — 64 articles, 26 obligations, 2 penalty tiers

## Links

- [GitHub Repository](https://github.com/rob-otix-ai/lexius)
- [MCP Server Package](https://www.npmjs.com/package/@robotixai/lexius-mcp)
- [Report Issues](https://github.com/rob-otix-ai/lexius/issues)

## License

MIT
