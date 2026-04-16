# PRD-007: Provenance Tier 1 — Honest Labelling, Derivation, History

## Status: Draft
## Date: 2026-04-16
## Author: Robert

---

## Problem Statement

Lexius blends three kinds of content in a single store with no visible distinction:

1. **Verbatim regulation text** fetched from CELLAR (articles, after PRD-006)
2. **Curated interpretation** hand-written by domain experts (obligations, penalties, deadlines, risk categories)
3. **AI-generated content** produced by the enhancement agent or seed authors (FAQ, derived summaries, some obligations)

A user querying `get_obligation(...)` receives an object with no indication of whether the statement is verbatim law, expert interpretation, or model output. A compliance officer who cites an unlabelled obligation in evidence is exposed — and so are we.

PRD-006 introduced `verbatim: boolean` on articles, which is binary: "fetched from source" vs "not". That is too coarse: a paraphrased article, an expert-curated obligation, and an AI-generated FAQ answer all collapse to `verbatim = false`, even though they carry very different trust weights.

We also cannot answer two defensive questions:

- *"Where did this obligation come from?"* — obligations reference at most one `article: text` string, not a typed, multi-valued link back to source articles.
- *"What did this article say before the 2026-08 amendment?"* — the fetcher upserts in place; old text is destroyed on update.

## Vision

Every piece of content in Lexius is labelled with a **provenance tier** — `AUTHORITATIVE`, `CURATED`, or `AI_GENERATED` — visible in every API response, MCP tool, and audit report. Derived content (obligations, FAQ) carries a typed **derivation chain** pointing back to the source articles it paraphrases. Every update to an authoritative article **archives** the previous version, so "what the regulation said on date X" is always recoverable.

Tier 1 is the minimum defensible provenance: honest labels, traceable lineage, preserved history. Cryptographic guarantees (Merkle roots, RFC 3161 timestamps) are deferred.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | See tier badge on every fact so they know what they can cite to legal counsel without qualification |
| **Auditor** | Trace any obligation back to the article(s) it derives from; verify the cited text against the recorded source hash |
| **Platform Operator** | Recover prior article text when a regulation is amended, without restoring from backup |
| **Developer** | Write seed/fetcher code that is rejected at contract-check time if it forgets to assign a tier |
| **Agent (LLM consumer)** | Read tier field on retrieved context and weight reasoning accordingly (don't quote `AI_GENERATED` as if it were law) |

## Product Requirements

### P0 — Must Have

1. **Tiered provenance enum** — every provenance-bearing entity exposes a `provenance_tier` field with values `AUTHORITATIVE` | `CURATED` | `AI_GENERATED`. Applies to: `articles`, `obligations`, `faq`, `penalties`, `deadlines`, `risk_categories`.
2. **Tier semantics fixed and documented** —
   - `AUTHORITATIVE`: verbatim text from an official source (CELLAR XHTML/Formex, legislation.gov.uk, national gazette). Must have non-null `source_hash`, `source_url`, `fetched_at`.
   - `CURATED`: written or reviewed by a named domain expert with attribution. Must have `curated_by` (string: person or team) and `reviewed_at` (timestamp).
   - `AI_GENERATED`: model output, not reviewed by a human expert. Must have `generated_by_model` (e.g., `claude-opus-4-6`) and `generated_at`.
3. **Derivation chain** — `obligations.derived_from: text[]` and `faq.derived_from: text[]` list the article IDs (e.g., `eu-ai-act-art-9`, `eu-ai-act-art-10`) the row paraphrases or interprets. Empty array means "no specific article" (not null).
4. **Article revisions history** — a new `article_revisions` table archives the prior version of an article whenever the fetcher updates it. Contains: `article_id`, `source_hash`, `full_text`, `title`, `fetched_at`, `superseded_at`. Insert-only from the fetcher; never mutated.
5. **Surfacing in API and MCP** —
   - REST API responses include `provenanceTier` (camelCase) on every returned entity.
   - MCP tool responses include the same.
   - Audit report rendering shows a tier badge next to every cited fact.
6. **Migration preserves existing data** — on migration run, articles with `verbatim = true` become `AUTHORITATIVE`; articles with `verbatim = false` become `CURATED`; seeded obligations/FAQ default to `CURATED`; AI-authored FAQ (flagged by seed author) are `AI_GENERATED`. No data loss.
7. **Contract enforcement** — Specflow contract `feature_provenance.yml` fails CI if:
   - A new row is written to a provenance-bearing table without a `provenance_tier`.
   - A row is `AUTHORITATIVE` without `source_hash`, `source_url`, and `fetched_at`.
   - A row is `CURATED` without `curated_by` and `reviewed_at`.
   - A row is `AI_GENERATED` without `generated_by_model` and `generated_at`.
   - The fetcher updates an existing article row without inserting into `article_revisions` first.

### P1 — Should Have

8. **`GetDerivationChain` use case** — given an obligation ID, return the chain of source articles (verbatim text + hashes) it derives from. Backs a future `trace_obligation` MCP tool.
9. **Tier filter on retrieval** — `list_obligations({ minTier: "CURATED" })` returns only `CURATED` and `AUTHORITATIVE` rows, suppressing `AI_GENERATED` unless explicitly requested.
10. **Revisions query** — `get_article_history(articleId)` returns the chronological list of revisions including the current row.
11. **Audit report annotation** — every citation in `ComplianceReport` records the tier of the cited fact; the final report groups reliance by tier ("17 obligations cited, of which 12 `CURATED`, 5 `AI_GENERATED`").

### P2 — Nice to Have

12. **Tier decay warning** — if `CURATED` content has `reviewed_at` older than 12 months and its `derived_from` article has been superseded (new revision), surface a "stale curation" warning on query.
13. **UI surfacing** — once a UI exists, tier badges render inline (colour-coded: green/amber/grey).
14. **Curator audit** — `list_by_curator(name)` lists all `CURATED` content attributed to a given person, for reviewer workload tracking.

## Out of Scope

- **Append-only audit log of every write** — Tier 2; this PRD only preserves article history, not diffs of every mutation.
- **Reproducible audit reports** — Tier 2.
- **Merkle roots / RFC 3161 timestamping** — Tier 3.
- **UI changes** — backend + API only for Tier 1.
- **Tier promotion workflow** — no process yet for moving `AI_GENERATED` → `CURATED` after review; that's a curation tool, out of scope.
- **Removing the `verbatim` boolean** — kept for backward compatibility in this release; deprecated path is documented but deletion is a future change.

## Success Metrics

- Every row in `articles`, `obligations`, `faq`, `penalties`, `deadlines`, `risk_categories` has a non-null `provenance_tier` after migration.
- No `AUTHORITATIVE` row exists without the required provenance fields (enforced by contract; zero CI failures).
- Running the fetcher against an amended regulation produces N rows in `article_revisions` (one per changed article) and the current text in `articles`.
- A user calling `GET /api/obligations/:id` receives a response that includes `provenanceTier`, `derivedFrom`, and (for `CURATED`) `curatedBy`.
- `GenerateAuditReport` output includes a "Reliance by Tier" summary.
- A compliance officer asked "is this verbatim law or our interpretation?" can answer from a single API field.

## Rollout

1. Schema migration (add columns, create `article_revisions`, backfill tiers from existing `verbatim` + seed metadata).
2. Fetcher writes revisions on update; marks all fetched rows `AUTHORITATIVE`.
3. Seed authoring updated to require tier + provenance fields (types enforce; CI enforces).
4. API + MCP response types updated; consumers re-emit camelCase fields.
5. Audit report template updated to render tier badges and the reliance summary.
6. Contract `feature_provenance.yml` lands in `tests/contracts/` and is wired into CI.

Failure at any step blocks the release; there is no partial Tier 1.
