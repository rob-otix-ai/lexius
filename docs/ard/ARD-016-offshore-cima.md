# ARD-016: Offshore Legislation Architecture — PDF Source Adapter

## Status: Accepted
## Date: 2026-04-19

---

## Context

The fetcher is hardcoded to CELLAR XHTML. PRD-012 requires ingesting CIMA (Cayman Islands) legislation from PDF. This is the first non-EU source, and the architecture must support future offshore jurisdictions (BMA, JFSC, GFSC) that also publish PDFs.

## Decision

### 1. Source adapter interface in `@lexius/fetcher`

```typescript
interface SourceAdapter {
  fetch(config: SourceConfig): Promise<ParsedRegulation>;
}

interface SourceConfig {
  legislationId: string;
  url: string;
  sourceType: "cellar" | "pdf";
  jurisdiction?: string;
}
```

Two implementations:
- `CellarAdapter` — refactored from the existing `cellar-client.ts` + `xhtml-parser.ts`
- `PdfAdapter` — new, uses `pdfjs-dist` for text extraction + a common-law section parser

The `ingest` function accepts a `SourceConfig` instead of hardcoded CELEX params. The existing `--celex` CLI flag continues to work (maps to `CellarAdapter`).

Rejected alternatives:
- **Separate package `@lexius/pdf-fetcher`** — splits a single concern (ingestion) across two packages. The adapter pattern keeps it in one.
- **Cheerio for PDF HTML export** — some PDFs can be converted to HTML, but the conversion is lossy and adds a dependency chain.

### 2. PDF text extraction via pdfjs-dist

`pdfjs-dist` (Mozilla's PDF.js) is the standard. It runs in Node.js, handles text-based PDFs (all CIMA legislation), and exposes per-item metadata including `hasEOL` for line break detection.

Text extraction: iterate pages → `getTextContent()` → join items with newlines at `hasEOL` boundaries. This produces clean, line-broken text identical to what a human reads.

Rejected alternatives:
- **pdf-parse** — newer API (v2.x) but unstable export pattern, harder to use.
- **pdf2json** — focused on layout, overkill for text extraction.
- **External tools (pdftotext, poppler)** — adds a system dependency. pdfjs-dist is pure JS.

### 3. Common-law section parser

EU law uses "Article N". Common-law jurisdictions (Cayman, Bermuda, Jersey, Guernsey) use "Section N" or just "N." at the start of a line.

The parser splits on the pattern `^\d+[A-Z]?\.\s` where:
- `\d+` is the section number
- `[A-Z]?` handles amended sections (e.g., `2A.`, `6A.`)
- Everything between two section markers is one section's body

Heuristics to skip false positives:
- Table of contents entries (contain `...` or very short lines)
- Page headers/footers (`Page N`, `Revised as at`, copyright marks)
- Schedule/appendix numbering (different pattern, handled separately)

Tested against 3 CIMA acts: 240 sections parsed, 74 penalties found.

### 4. Section ID scheme

EU articles use `<legislation>-art-<N>` (e.g., `eu-ai-act-art-99`). CIMA sections use `<legislation>-s-<N>` (e.g., `cima-monetary-authority-s-42A`).

The `s-` prefix distinguishes common-law sections from EU articles. Both share the same `articles` table — the `number` column stores `"42A"` and the ID encodes the convention.

### 5. Currency-aware extraction

The existing fine-amount extractor matches `EUR\s*[\d\s,\.]+`. CIMA uses Cayman Islands Dollars (KYD), expressed as "ten thousand dollars" or "$10,000".

Two approaches:
- **Extend the existing extractor** with a dollar-amount regex alongside the EUR one. Store as `fine_amount_kyd` extract type.
- **Add `fine_amount_local` as a generic type** with a `currency` field on the extract.

Choice: extend with `fine_amount_kyd`. Keep it simple; add `fine_amount_local` if a third currency appears.

### 6. Provenance for PDF sources

PDF-sourced sections are `AUTHORITATIVE` because they are verbatim text from an official government publication. The `source_format` is `"pdf"` (vs `"xhtml"` for CELLAR). The `source_hash` is SHA-256 of the section body text. The `source_url` is the PDF download URL.

The PDF itself is hashed on download and stored on the `legislations` table as `content_hash` for idempotency — if the PDF hasn't changed, no re-parse needed.

### 7. CIMA registry as a configuration file

```yaml
# packages/fetcher/src/registries/cima.yml
jurisdiction: KY
regulator: CIMA
acts:
  - id: cima-monetary-authority
    name: "Monetary Authority Act (2020 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf"
    effectiveDate: "2020-01-14"
  - id: cima-banks-trust
    name: "Banks and Trust Companies Act (2025 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf"
    effectiveDate: "2025-02-07"
  # ... 8 more
```

Adding a new CIMA act = adding a YAML entry. No code change.

## Consequences

### Positive
- Lexius becomes genuinely multi-jurisdictional (not just multi-regulation within the EU)
- The PDF adapter is reusable for BMA, JFSC, GFSC — one adapter, many jurisdictions
- CIMA compliance officers get the same provenance guarantees as EU users
- 162 CIMA PDFs are accessible without any API key or authentication

### Negative
- `pdfjs-dist` adds ~15MB to the fetcher package (in dev; bundled for npm it's part of the CJS blob)
- PDF text extraction is slower than XHTML parsing (~2-3 seconds per PDF vs ~0.5s for CELLAR)
- Common-law section numbering is less uniform than EU article numbering — edge cases will surface
- No amendment tracking (CIMA publishes consolidated revisions, not diffs)

### Mitigations
- pdfjs-dist is tree-shakable; only the legacy build is needed (no canvas/DOM)
- Section parser has fixture tests for each CIMA act's specific formatting
- Consolidated revisions are actually simpler than EU amendments — the whole act is re-published as one PDF
