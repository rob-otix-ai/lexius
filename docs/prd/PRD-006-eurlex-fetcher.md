# PRD-006: EUR-Lex Regulation Fetcher

## Status: Draft
## Date: 2026-04-16
## Author: Robert

---

## Problem Statement

Lexius currently stores regulation article summaries that are AI-paraphrased, not verbatim EU legislation. This is acceptable for prototyping but fails a compliance audit: a user seeing "Article 6: Financial entities must have a sound, comprehensive..." reasonably believes that's what Article 6 says. It might be approximately right, but we haven't verified it against the official text.

Every regulation we add (DORA, NIS2, CIMA) will compound this problem unless we fix the source.

## Vision

An authoritative ingestion pipeline: regulation text comes from the Publications Office CELLAR API (the official machine-readable source), parsed article-by-article, stored verbatim with provenance tracking.

When a user queries `get_article("eu-ai-act", "5")`, they get the actual Article 5 text from Regulation (EU) 2024/1689 — not our paraphrase.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | Defensible regulation text — can quote directly to legal counsel |
| **Auditor** | Verify platform citations against the source |
| **Platform Operator** | Refresh regulation text when amendments are published |
| **Developer** | Add a new regulation by CELEX ID, not by hand-typing article summaries |

## Product Requirements

### P0 — Must Have

1. **Fetch from CELLAR REST API** — `publications.europa.eu/resource/celex/{CELEX}` with content negotiation
2. **Format preference** — Formex XML (cleanest) with XHTML fallback (ELI-tagged)
3. **Article-by-article parsing** — extract article number, title, and body text; map to our `articles` table schema
4. **Verbatim text storage** — no paraphrasing; store exactly what the regulation says
5. **Provenance tracking** — every article row records: `sourceUrl`, `sourceFormat` (fmx4|xhtml), `sourceHash` (SHA-256 of body text), `fetchedAt` (timestamp)
6. **CLI command** — `lexius-fetch --celex 32024R1689 --legislation eu-ai-act`
7. **Idempotency** — re-running against an unchanged source is a no-op (hash comparison)
8. **Change detection** — if source changed, log which articles changed and re-embed only those
9. **Regulations supported at launch** — EU AI Act (32024R1689) and DORA (32022R2554)

### P1 — Should Have

10. **Annex extraction** — regulations' annexes become articles with number prefix `annex-X`
11. **Bulk refresh** — `lexius-fetch --all` refreshes every legislation in the DB
12. **Dry-run mode** — `--dry-run` shows what would change without writing
13. **Scheduled refresh** — GitHub Action that runs monthly and opens a PR if regulation text changed

### P2 — Nice to Have

14. **Language support** — fetch French/German/Italian versions (secondary translations)
15. **Comparison view** — diff two versions of a regulation
16. **Recital extraction** — separate table for recitals (explanatory text, numbered differently)

## Out of Scope

- EUR-Lex SOAP API (requires registration, slower)
- Scraping the gated `eur-lex.europa.eu` HTML (anti-bot blocked)
- Akoma Ntoso (not available in CELLAR)
- National transposition tracking (NIS2 per-MS laws)
- Obligations, FAQs, risk categories — those stay hand-curated (clearly labelled)

## Success Metrics

- User running `lexius article eu-ai-act 5` sees verbatim Article 5 text from Regulation 2024/1689
- Every article row has a non-null `sourceHash`
- Re-running fetcher on unchanged source produces zero writes
- Fetcher handles both EU AI Act and DORA in under 60 seconds each
- A compliance officer can cite `packages/db/src/seeds/...` to prove text provenance
