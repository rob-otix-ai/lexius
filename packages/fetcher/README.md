# @robotixai/lexius-fetcher

EUR-Lex CELLAR fetcher + deterministic extractor for the [Lexius](https://github.com/rob-otix-ai/lexius) compliance platform. Fetches verbatim regulation text from the Publications Office and extracts typed facts (fine amounts, percentages, dates, cross-references, shall-clauses).

## Quick Start

```bash
# 1. Start the database
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -e POSTGRES_USER=$POSTGRES_USER \
  robotixai/lexius-db
export DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB

# 2. Fetch EU AI Act (articles + annexes + extract facts)
npx @robotixai/lexius-fetcher ingest --celex 32024R1689 --legislation eu-ai-act

# 3. Fetch DORA
npx @robotixai/lexius-fetcher ingest --celex 32022R2554 --legislation dora
```

## Commands

### `ingest` — Fetch + extract in one pass

```bash
npx @robotixai/lexius-fetcher ingest \
  --celex 32024R1689 \
  --legislation eu-ai-act
```

Fetches verbatim XHTML from EUR-Lex CELLAR, parses articles + annexes, writes to the `articles` table as AUTHORITATIVE, then runs the deterministic extractor to populate `article_extracts`.

Options:
- `--celex <id>` — CELEX number (e.g., `32024R1689` for EU AI Act)
- `--legislation <id>` — Legislation ID in the database
- `--dry-run` — Parse but don't write
- `--no-extract` — Skip the extractor pass

### `extract` — Run extractor on existing articles

```bash
npx @robotixai/lexius-fetcher extract --legislation eu-ai-act
npx @robotixai/lexius-fetcher extract --article eu-ai-act-art-99
```

### `backfill-derivation` — Auto-populate derivedFrom

```bash
# See what would change
npx @robotixai/lexius-fetcher backfill-derivation --legislation eu-ai-act

# Apply
npx @robotixai/lexius-fetcher backfill-derivation --legislation eu-ai-act --apply
```

Uses article cross-reference extracts to propose `derivedFrom` additions on curated obligations, FAQ, and penalties.

## What it extracts

| Extract type | Example | Source |
|---|---|---|
| `fine_amount_eur` | EUR 35,000,000 | Art. 99(3) |
| `turnover_percentage` | 7% | Art. 99(3) |
| `date` | 2 August 2026 | Art. 113 |
| `article_cross_ref` | "referred to in Article 5" | Throughout |
| `annex_cross_ref` | "Annex III" | Throughout |
| `shall_clause` | "providers shall establish..." | Throughout |

All extracts are AUTHORITATIVE — deterministic regex parsing, no LLM.

## Database

Requires a PostgreSQL database with the Lexius schema. Fastest setup:

```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=legal_ai \
  -e POSTGRES_USER=legal_ai \
  robotixai/lexius-db
```

## Links

- [GitHub Repository](https://github.com/rob-otix-ai/lexius)
- [MCP Server](https://www.npmjs.com/package/@robotixai/lexius-mcp)
- [CLI](https://www.npmjs.com/package/@robotixai/lexius-cli)
- [Agent](https://www.npmjs.com/package/@robotixai/lexius-agent)

## License

MIT
