# PRD-008: Deterministic Regulation-Text Extractor

## Status: Draft
## Date: 2026-04-16
## Author: Robert

---

## Problem Statement

Lexius now holds verbatim regulation text thanks to PRD-006 and PRD-007, but the high-risk fields — penalty amounts, deadline dates, article cross-references — are still hand-typed in seed files. Nothing cross-checks them against the verbatim source. A seed author can write `maxFineEur: "3500000"` (3.5M) instead of `"35000000"` (35M) for the EU AI Act prohibited-practices penalty and Tier 1 will dutifully label it `CURATED` — tier means "a human claims this"; it does not mean "this is right."

For every new legislation added (DORA, NIS2, CIMA, UK AI Bill), the same hand-typing risk compounds. Numbers and dates are the easiest thing for a human to get wrong and the highest-consequence thing for a compliance claim to get wrong.

The good news: for a specific subset of fields, the verbatim text already contains the answer in a mechanically extractable form. Art. 99 literally reads "up to EUR 35,000,000 or … 7% of its total worldwide annual turnover". Art. 113 literally reads "shall apply from 2 August 2026". Cross-references like "as referred to in Article 5" point at articles we already store. These are **deterministically extractable**: regex or structural parsing reads them directly out of the Formex/XHTML we've already fetched.

## Vision

A deterministic extractor module that reads fetched article text and produces a new kind of row — an **article extract** — holding a single raw fact lifted verbatim from the source (a fine amount, a date, a percentage, an article cross-reference, an obligation "shall" clause). Every extract is tagged `AUTHORITATIVE` because it came from the verbatim law with no interpretation.

Curated rows (penalties, obligations, FAQ, deadlines) then **reference** the extracts they claim to encode. A cross-check — running in CI and on-demand — flags any curated claim whose numeric or date value does not match an extract on one of its `derivedFrom` articles. "You wrote maxFineEur=3,500,000 but the extracted fine amount from Art. 99(3) is 35,000,000" fails CI.

No LLM. No paraphrasing. No new interpretation. Pure mechanical transformation from verbatim text to typed facts, plus a consistency test.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | Cite a penalty amount knowing it was verified against verbatim regulation text, not a typo |
| **Auditor** | Trace any numeric or date claim back to the exact paragraph of the law it came from |
| **Platform Operator** | Re-fetch a regulation after an amendment and have every affected curated row automatically flagged for review |
| **Developer (seed author)** | Get a CI failure before merge if a typed-in number disagrees with the law |
| **Developer (new legislation)** | Run the extractor once to pre-populate `derivedFrom`, penalty amounts, and deadline dates, saving the hand-curation error surface |

## Scope — what the extractor does and doesn't

### In scope

For each fetched article, deterministically extract:

1. **Fine amounts** — EUR figures near penalty language (regex: `EUR\s*[\d\s,\.]+`, plus proximity to "fine"/"penalty"/"administrative").
2. **Turnover percentages** — percentage figures near penalty language (`\b\d+(?:\.\d+)?\s*%`).
3. **Dates** — absolute dates in the article text (`\b\d{1,2}\s+(January|…|December)\s+\d{4}\b`, also `\d{4}-\d{2}-\d{2}`).
4. **Article cross-references** — phrases like "referred to in Article N", "under Article N", "pursuant to Article N" → emit extract pointing at the cited article's ID within the same legislation.
5. **Annex cross-references** — same for "Annex I", "Annex III point 1".
6. **Obligation "shall" clauses** — sentences inside an article whose main verb is `shall` / `must` / `shall not`. Store the full sentence verbatim with a `subject_hint` (the subject noun if it sits in the first 30 characters: "providers", "deployers", "the Commission", "Member States") and a `paragraph_ref` (the paragraph number).

### Out of scope (explicit)

- **Obligation ontology** — `role`, `riskLevel`, `category`. These are Lexius concepts, not in the text. Curators still assign them.
- **FAQ generation** — FAQs do not exist in the source; the extractor does not invent them.
- **Risk-category taxonomy** — Annex III items extract as a structured list, but the `level` / `keywords` / `examples` remain curated.
- **Penalty-row `applicableTo`** — our enum, not law's text.
- **`smeRules` jsonb shape** — the extracted text goes into an extract row; the structured JSON stays curated.
- **Any LLM involvement.** No model calls. No rewriting. If it can't be matched by a regex or a Formex structural rule, it does not belong in this extractor.
- **Recitals.** Defer to a future PRD.
- **Multilingual extraction.** English-only for this release; French/German/Italian parser variants are a future extension.

## Product Requirements

### P0 — Must Have

1. **New `article_extracts` table** — one row per extracted fact. Columns: `id`, `article_id`, `extract_type` (enum), `value_numeric` (nullable), `value_text` (nullable), `value_date` (nullable), `paragraph_ref` (text), `verbatim_excerpt` (text — the surrounding sentence), `provenance_tier` (always `AUTHORITATIVE`), `source_hash` (of the article at extraction time), `extracted_at`.
2. **Extract types supported in P0** — `fine_amount_eur`, `turnover_percentage`, `date`, `article_cross_ref`, `annex_cross_ref`, `shall_clause`. Additional types in P1.
3. **CLI command** — `lexius-fetch extract --celex 32024R1689 --legislation eu-ai-act` runs the extractor over articles already in the DB for that legislation. Also: `lexius-fetch ingest --celex X` runs fetch + extract in one pass.
4. **Idempotency** — re-running the extractor against unchanged articles is a no-op. Extracts are keyed on `(article_id, extract_type, paragraph_ref, value_hash)`; re-extracting the same fact from the same hash just updates `extracted_at`.
5. **Re-extraction on article update** — when the fetcher's `archive_article_revision` trigger fires (article text changed), all extracts for that article are invalidated and re-run on the new text. Old extracts are preserved via an `article_extract_revisions` table (parallel to `article_revisions`), with a DB-level trigger.
6. **Cross-reference auto-populates `derivedFrom`** — on extract, for every `article_cross_ref` extract found in Article N's text pointing at Article M, every curated row whose `derivedFrom` contains the host article's ID is offered a candidate addition. Initially: only log candidates. In P1, a seed helper surfaces them; in P2, they auto-apply.
7. **Numeric cross-check Specflow contract** — `tests/contracts/extractor_crosscheck.yml` runs at CI time. For every row in `penalties`, `deadlines` where a numeric/date value is set and `derivedFrom` is non-empty, there must exist at least one extract row on the referenced article with a matching value. Mismatches fail CI.
8. **Provenance integration** — every `article_extracts` row has `provenance_tier = 'AUTHORITATIVE'`, `source_hash = <article.source_hash at extraction time>`, `extracted_at` recorded. No CURATED or AI_GENERATED extracts are possible.
9. **Runs against existing fetched legislations at launch** — EU AI Act (32024R1689) and DORA (32022R2554) both extract cleanly on first run, generating the expected counts of fine_amount / turnover_percentage / date rows (verified against hand-counts before merge).
10. **Pure — no LLM, no network** — the extractor reads only the DB and emits only DB writes. Confirmed by a Specflow contract (forbidden imports: `@anthropic-ai/sdk`, `openai`, `fetch` at call sites).

### P1 — Should Have

11. **Auto-populate `derivedFrom` on missing rows** — for the 6 EU AI Act FAQ rows flagged in Tier 1 (Wave 1 report) with empty `derivedFrom`, the extractor's cross-ref output is used to propose values; a CLI command (`lexius-fetch backfill-derivation`) applies them with `--dry-run` by default.
12. **Obligation clause linking** — for every curated obligation row, find the best-matching extracted `shall_clause` on its `derivedFrom` articles (by cosine similarity on the existing embeddings) and store the extract ID in a new `obligations.derived_from_extracts` column. Surfaces in the API as `"the verbatim clause this obligation paraphrases: …"`.
13. **Annex structural parsing** — extract the numbered list items from Annex III and similar annexes as typed rows (`annex_item` extract type); a follow-up feeds them into the `risk_categories` seed as candidates.
14. **Date labelling from context** — when an extracted date sits in a sentence containing known phrases ("shall apply from", "shall enter into force on", "by …"), emit a `date_label` hint on the extract. Curators use it to label the deadline event; still curated, but with a strong suggestion.

### P2 — Nice to Have

15. **Numeric cross-check with auto-fix suggestion** — when CI flags a mismatch, output a machine-readable patch candidate (proposed field value + extract ID) that a developer can accept with one command.
16. **Multi-CELEX citation detection** — regulations often cite other regulations ("Regulation (EU) 2016/679"); detect these so external cross-references can link to legislation IDs once those legislations are fetched.
17. **Cross-legislation drift detection** — if Art. 99(3)'s fine_amount extract changes in a future amendment, every penalty row deriving from it is flagged `review_required` (builds on Tier 1 `article_revisions` foundation).

## Out of Scope

- LLM-based extraction of any field.
- Generation of new obligations, FAQs, or risk categories from article text (that's PRD-009 if we ever decide we want it).
- Parser support for PDFs or scanned documents; CELLAR XHTML/Formex only.
- Extraction from Annex text beyond Annex III list items.
- National-law transposition parsing (NIS2-style MS laws).
- Any form of validation that would require domain knowledge beyond "the law says this number / this date / this cross-ref."

## Success Metrics

- Every penalty row in the DB either (a) has a matching `fine_amount_eur` extract on one of its `derivedFrom` articles, or (b) carries an explicit `extract_exempt: true` flag with a reason (tiny set; e.g., SME-specific carve-outs where the law expresses the amount as a function rather than a literal number).
- Running the extractor on EU AI Act Art. 99 produces at least three `fine_amount_eur` extracts (35M / 15M / 7.5M) and three `turnover_percentage` extracts (7% / 3% / 1.5%).
- The 6 FAQ rows with empty `derivedFrom` flagged by Tier 1 have non-empty `derivedFrom` after the extractor's backfill runs (or the rows are explicitly annotated as "no article cross-reference exists in the FAQ's subject matter").
- A single CI failure reliably catches a transposed-digit bug in a seed before merge, verified by an adversarial test.
- Re-running the extractor on unchanged articles produces zero writes.
- Adding a new legislation (e.g., NIS2) by CELEX does not require any hand-typed fine amounts or cross-refs; those come from the extractor's output directly and the seed author's job shrinks to assigning ontology (role, riskLevel, category).

## Rollout

1. Schema migration: `article_extracts` table, `article_extract_revisions` table, extract type enum, trigger on extract update.
2. Parser modules — one per extract type, each with unit tests against fixture snippets.
3. CLI wiring in `@lexius/fetcher` (new `extract` subcommand) + orchestrator in `ingest.ts`.
4. Run extractor over existing EU AI Act + DORA articles; record baseline counts.
5. Cross-check contract `extractor_crosscheck.yml` lands; CI enforces on every PR from there on.
6. Backfill the 6 FAQ `derivedFrom` gaps.
7. Document in `README.md` how to add a new legislation (two commands instead of a hand-seed).

Each step is a mergeable PR; step 5 is the gate that locks in the "no more typos" property.
