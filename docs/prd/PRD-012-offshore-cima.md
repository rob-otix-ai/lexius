# PRD-012: Offshore Legislation — CIMA (Cayman Islands)

## Status: Draft
## Date: 2026-04-19
## Author: Robert

---

## Problem Statement

Lexius covers 10 EU regulations via EUR-Lex CELLAR. But compliance officers working with offshore financial services need the same provenance-tracked, deterministic analysis for non-EU jurisdictions — starting with the Cayman Islands Monetary Authority (CIMA).

CIMA publishes 162 legislation PDFs at `cima.ky/laws-and-regulations`. No API. No structured data. No XHTML. Just PDFs. The fetcher today is hardcoded to CELLAR XHTML parsing and cannot ingest PDF sources.

Adding CIMA is the proof that Lexius is genuinely legislation-agnostic — not just EU-agnostic.

## Vision

A compliance officer runs `lexius-fetch ingest --source cima --legislation cima-monetary-authority` and gets the Monetary Authority Act parsed into sections, stored as AUTHORITATIVE with a PDF source hash, and ready for the extractor to pull out fines, cross-references, and obligation clauses. The same agent, MCP, CLI, and API that answer EU AI Act questions now answer CIMA questions.

## Users

| Persona | Need |
|---------|------|
| **Offshore Compliance Officer** | Query CIMA obligations, penalties, and deadlines with the same provenance guarantees as EU regulations |
| **Fund Administrator** | Check which CIMA regulations apply to their fund structure (mutual funds, private funds, VASP) |
| **RegTech Developer** | Extend Lexius to additional offshore jurisdictions using the same PDF adapter |

## Scope

### In Scope

1. **PDF source adapter** — a new source type alongside the existing CELLAR adapter. Downloads a PDF from a URL, extracts text via `pdfjs-dist`, parses into sections using common-law numbering conventions (`N. Title` / `N. (1) Body text`).
2. **CIMA legislation registry** — metadata for key CIMA acts with PDF URLs:
   - Monetary Authority Act (2020 Revision)
   - Banks and Trust Companies Act (2025 Revision)
   - Mutual Funds Act (2025 Revision)
   - Private Funds Act (2025 Revision)
   - Securities Investment Business Act (2020 Revision)
   - Insurance Act (2010)
   - Anti-Money Laundering Regulations (2025 Revision)
   - Virtual Asset (Service Providers) Act (2024 Revision)
   - Proceeds of Crime Act (2024 Revision)
   - Beneficial Ownership Transparency Act (2023)
3. **Common-law section parser** — splits PDF text into sections using the `N.` / `NA.` pattern. Handles Parts, subsections `(1)(a)`, and cross-references (`section 6(5)(a)`).
4. **Penalty extraction** — the existing extractor's fine-amount regex adapted for Cayman dollar amounts ("fine of ten thousand dollars") and imprisonment terms.
5. **Section cross-reference extraction** — "section 6(5)(a) of the Banks and Trust Companies Act" → `cima-banks-trust-s-6`.
6. **Provenance** — PDF-sourced sections are `AUTHORITATIVE` with `source_format: "pdf"`, `source_hash: sha256(section_text)`, `source_url: <pdf_url>`.
7. **Generic plugin** — the existing `GenericPlugin` handles CIMA with no custom classification logic needed initially.

### Out of Scope

- CIMA guidance notes and regulatory policies (not legislation)
- Bermuda (BMA), Jersey (JFSC), Guernsey (GFSC) — future PRDs using the same PDF adapter
- Curated obligations, FAQ, risk categories for CIMA (future curation work)
- OCR for scanned PDFs (CIMA PDFs are text-based)
- Amendment tracking (CIMA publishes consolidated revisions; version comparison deferred)

## Product Requirements

### P0 — Must Have

1. **Source adapter interface** — `SourceAdapter` with a `fetch(config): Promise<ParsedArticle[]>` method. Two implementations: `CellarAdapter` (existing XHTML) and `PdfAdapter` (new).
2. **PDF text extraction** — `pdfjs-dist` in Node.js. EOL-aware text joining (using `hasEOL` flag on text items). Handles multi-page documents.
3. **Common-law section splitter** — splits text on `N.` boundaries, extracts section number, title, and body. Skips table of contents pages, page headers/footers. Handles `NA.` (e.g., `2A.`, `6A.`).
4. **CLI integration** — `lexius-fetch ingest --source pdf --url <pdf_url> --legislation <id>` for ad-hoc PDF ingest. Also: `lexius-fetch ingest --source cima --legislation <id>` using the CIMA registry to look up the PDF URL.
5. **Idempotency** — re-ingesting the same PDF (same hash) is a no-op, same as CELLAR.
6. **Extractor compatibility** — the existing 6 extractors run over PDF-sourced sections without modification. Fine amounts in "dollars" (no EUR prefix) need a regex variant.
7. **10 CIMA acts ingested at launch** — verified section counts and penalty extraction against manual review.

### Simulation Results (verified against all 10 CIMA PDFs)

Full simulation tested all 10 CIMA PDFs. Raw output: 1,228 sections parsed, 254 penalty-bearing sections found.

**Three systemic edge cases discovered (all must be handled in P0):**

1. **Duplicate section numbers (every act, ~400 entries total).** Common-law drafting repeats the section number: once as a title line (`3. Determination of fitness and propriety`) and again as the body start (`3. In determining for the purposes of this Act...`). The parser must merge consecutive entries with the same section number — treat the first as the title, the second as the body. Without merging, the section count is inflated and many sections are stubs.

2. **Leaked page headers (216 sections across all acts).** Each page of a CIMA PDF carries the act name in its header (e.g., `Monetary Authority Law (2020 Revision)`). The generic filter catches `Page N`, `Revised as at`, and `c` but misses legislation-specific headers. Fix: detect the act title from the first page and add it to the skip list dynamically for each PDF.

3. **Huge definitions sections (5 across 4 acts, up to 19K chars).** Section 2 in most CIMA acts contains thousands of characters of defined terms. This is legitimate — not a parser bug. Accept as valid in P0. Optionally split on defined-term boundaries (`"term" means...`) as sub-sections in P1.

**What was NOT an issue:**
- Zero download failures (all 10 PDFs accessible at their URLs)
- Zero section numbering gaps
- All section boundaries identifiable by the `N.` pattern
- 254 penalty-bearing sections extractable with fine amounts

**Per-act simulation data:**

| Act | Pages | Chars | Raw Sections | Duplicates | Penalties |
|-----|-------|-------|-------------|------------|-----------|
| Monetary Authority Act | 48 | 100K | 120 | 46 | 20 |
| Banks and Trust Companies Act | 32 | 64K | 50 | 20 | 11 |
| Mutual Funds Act | 48 | 102K | 100 | 44 | 27 |
| Private Funds Act | 32 | 62K | 59 | 24 | 16 |
| Securities Investment Business Act | 56 | 106K | 105 | 34 | 20 |
| Insurance Act | 36 | 71K | 84 | 34 | 11 |
| Anti-Money Laundering Regulations | 84 | 186K | 198 | 89 | 28 |
| Virtual Asset (Service Providers) Act | 44 | 96K | 70 | 29 | 21 |
| Proceeds of Crime Act | 164 | 363K | 380 | 125 | 93 |
| Beneficial Ownership Transparency Act | 33 | 67K | 62 | 26 | 7 |
| **Total** | | **1.2M** | **1,228** | **471** | **254** |

After deduplication and header filtering, expected clean section count: ~750-800.

### P1 — Should Have

8. **CIMA regulation registry** — a YAML or JSON config file mapping legislation IDs to PDF URLs + metadata. New CIMA regulations added by editing the file, not by code changes.
9. **Dollar amount extraction** — extend the fine-amount extractor to match `(\d[\d,]*)\s+dollars` alongside the existing EUR pattern. Store as `fine_amount_kyd` (Cayman Islands Dollar) extract type.
10. **Imprisonment term extraction** — new extract type `imprisonment_term` for "imprisonment for N years/months".
11. **Act cross-reference extraction** — "under the Banks and Trust Companies Act" → link to the other legislation. Cross-legislation linking within CIMA.

### P2 — Nice to Have

12. **Auto-discovery** — scrape `cima.ky/laws-and-regulations` for new PDF URLs, compare against the registry, flag new or updated regulations.
13. **PDF diff** — when a new revision of an act is published, diff the sections against the previous version and flag changes.
14. **BMA/JFSC/GFSC adapters** — reuse the PDF adapter with jurisdiction-specific section patterns.

## Success Metrics

- 10 CIMA acts ingested, producing 400+ sections stored as AUTHORITATIVE
- Every section has a non-null `source_hash` and `source_url`
- Penalty extraction finds 50+ fine amounts across the 10 acts
- The agent can answer "What are the penalties under the Monetary Authority Act?" with section-level citations
- Re-ingesting produces zero writes (idempotent)
- Adding a new CIMA regulation requires only a registry entry and `lexius-fetch ingest`

## Rollout

1. Source adapter interface + `PdfAdapter` implementation
2. Common-law section parser with tests
3. CIMA registry (10 acts with PDF URLs)
4. CLI `--source pdf` and `--source cima` flags
5. Extractor regex variants for dollar amounts
6. Ingest all 10 CIMA acts, verify counts
7. Seed CIMA legislation metadata + penalty data
8. Test with the agent
