# DDD-015: Offshore CIMA — Implementation

## Status: Draft
## Date: 2026-04-19

---

## Overview

Implementation details for PRD-012 / ARD-016. Covers: source adapter interface, PdfAdapter, common-law section parser, CIMA registry, extractor extensions, CLI changes, and the Specflow contract.

## Package Structure (additions)

```
packages/fetcher/src/
├── adapters/                    # NEW
│   ├── types.ts                 # SourceAdapter interface
│   ├── cellar.ts                # CellarAdapter (refactored from cellar-client + xhtml-parser)
│   ├── pdf.ts                   # PdfAdapter (pdfjs-dist text extraction)
│   └── index.ts                 # createAdapter factory
├── parsers/
│   ├── xhtml-parser.ts          # unchanged (used by CellarAdapter)
│   ├── section-parser.ts        # NEW — common-law section splitter
│   └── types.ts                 # ParsedArticle, ParsedRegulation (unchanged)
├── registries/                  # NEW
│   └── cima.yml                 # CIMA act registry (10 acts with URLs)
├── extractors/
│   ├── fine-amount.ts           # extended: KYD dollar amounts
│   ├── imprisonment.ts          # NEW: imprisonment term extraction
│   └── ...                      # existing extractors unchanged
└── ingest.ts                    # refactored: accepts SourceConfig
```

## Source Adapter Interface

```typescript
// packages/fetcher/src/adapters/types.ts

export interface SourceConfig {
  legislationId: string;
  url: string;
  sourceType: "cellar" | "pdf";
  jurisdiction: string;           // "EU" | "KY" | "BM" | "JE" | "GG"
  sectionPrefix: string;          // "art" for EU, "s" for common-law
}

export interface SourceAdapter {
  fetch(config: SourceConfig): Promise<ParsedRegulation>;
}
```

## PdfAdapter

```typescript
// packages/fetcher/src/adapters/pdf.ts

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseSections } from "../parsers/section-parser.js";
import type { SourceAdapter, SourceConfig } from "./types.js";
import type { ParsedRegulation } from "../parsers/types.js";
import { logger } from "../logger.js";

export class PdfAdapter implements SourceAdapter {
  async fetch(config: SourceConfig): Promise<ParsedRegulation> {
    logger.info({ url: config.url }, "Downloading PDF");
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`PDF download failed: ${response.status} for ${config.url}`);
    }

    const buffer = await response.arrayBuffer();
    const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;

    logger.info({ pages: doc.numPages }, "Extracting text from PDF");

    // Extract text with EOL-aware joining
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        const it = item as any;
        if ("str" in it) {
          pageText += it.str;
          if (it.hasEOL) pageText += "\n";
        }
      }
      pages.push(pageText);
    }

    const fullText = pages.join("\n\n");
    const sections = parseSections(fullText);

    logger.info(
      { legislationId: config.legislationId, sections: sections.length },
      "PDF parsed",
    );

    return {
      celex: "",
      legislationId: config.legislationId,
      sourceUrl: config.url,
      sourceFormat: "pdf",
      articles: sections,
      fetchedAt: new Date(),
    };
  }
}
```

## Common-Law Section Parser

The parser must handle three edge cases discovered by simulation across all 10 CIMA PDFs (1,228 raw sections tested):

### Edge Case 1: Title/Body Duplication

Common-law PDFs repeat the section number twice:
```
3.                                          ← title line (short)
Determination of fitness and propriety
3.                                          ← body start (long)
In determining for the purposes of this Act whether a person is a fit and
proper person, regard shall be had to all circumstances...
```

The parser must detect when two consecutive entries share the same number and merge them. Without merging, every act produces ~40-50% duplicate entries (~471 duplicates across 10 acts).

### Edge Case 2: Leaked Page Headers

Every page of a CIMA PDF carries the act name as a running header:
```
Monetary Authority Law (2020 Revision)
Section 42
Page 36
Revised as at 31st December, 2019
c
```

Static filters catch `Page N`, `Revised as at`, `Section N`, and `c`. But the act title (`Monetary Authority Law (2020 Revision)`) is legislation-specific and varies per PDF. The parser must detect this from the first page and add it dynamically to the skip list. Without this, ~216 sections contain leaked header text.

### Edge Case 3: Huge Definitions Sections

Section 2 in most CIMA acts is the definitions section — up to 19,116 characters (AML Regulations). This is legitimate. The parser accepts it. Optionally split on defined-term boundaries (`"term" means...`) in a future iteration.

### Implementation

```typescript
// packages/fetcher/src/parsers/section-parser.ts

import { createHash } from "node:crypto";
import type { ParsedArticle } from "./types.js";

const SECTION_START = /^(\d+[A-Z]?)\.\s+/;
const STATIC_SKIP = /^(?:Page \d+|Revised as at|^c$)/;
const TOC_ENTRY = /\.\.\./;

/**
 * Detect the act title from the first page for dynamic header filtering.
 * CIMA PDFs have the act name on every page header.
 */
function detectActTitle(text: string): string | null {
  const firstPage = text.split("\n\n")[0] || "";
  const lines = firstPage.split("\n").map((l) => l.trim()).filter(Boolean);
  // The act title is usually the 2nd or 3rd non-empty line on page 1
  // (after "CAYMAN ISLANDS")
  for (const line of lines.slice(1, 5)) {
    if (
      line.length > 15 &&
      !line.startsWith("Supplement") &&
      !line.startsWith("CAYMAN") &&
      /Act|Law|Regulations/i.test(line)
    ) {
      return line;
    }
  }
  return null;
}

export function parseSections(text: string): ParsedArticle[] {
  const actTitle = detectActTitle(text);
  const lines = text.split("\n");
  const raw: Array<{ number: string; title: string; bodyLines: string[] }> = [];
  let current: { number: string; title: string; bodyLines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip filters
    if (STATIC_SKIP.test(line)) continue;
    if (TOC_ENTRY.test(line)) continue;
    if (actTitle && line.includes(actTitle)) continue;
    if (/^Section \d+/.test(line) && line.length < 30) continue;

    const match = line.match(SECTION_START);
    if (match && line.length > 15) {
      if (current) raw.push(current);

      const rest = line.slice(match[0].length);
      const isTitle = /^[A-Z][a-z]/.test(rest) && rest.length < 80;

      current = {
        number: match[1],
        title: isTitle ? rest : "",
        bodyLines: isTitle ? [] : [rest],
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    }
  }

  if (current) raw.push(current);

  // Merge consecutive entries with the same section number
  // (common-law title/body duplication)
  const merged: typeof raw = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const next = raw[i + 1];

    if (next && next.number === entry.number) {
      // Merge: entry is the title, next is the body
      merged.push({
        number: entry.number,
        title: entry.title || entry.bodyLines.join(" ").slice(0, 80),
        bodyLines: [...entry.bodyLines, ...next.bodyLines],
      });
      i++; // skip next
    } else {
      merged.push(entry);
    }
  }

  // Build final sections
  const sections: ParsedArticle[] = [];
  for (const entry of merged) {
    const body = entry.bodyLines.join("\n").trim();
    if (body.length < 20) continue;

    const title = entry.title || body.split(/[.\n]/)[0].slice(0, 80);
    const hash = createHash("sha256").update(body).digest("hex");

    sections.push({ number: entry.number, title, body, sourceHash: hash });
  }

  return sections;
}
```

## CIMA Registry

```yaml
# packages/fetcher/src/registries/cima.yml
jurisdiction: KY
regulator: Cayman Islands Monetary Authority
sectionPrefix: s

acts:
  - id: cima-monetary-authority
    name: "Monetary Authority Act (2020 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf"
    effectiveDate: "2020-01-14"

  - id: cima-banks-trust
    name: "Banks and Trust Companies Act (2025 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf"
    effectiveDate: "2025-02-07"

  - id: cima-mutual-funds
    name: "Mutual Funds Act (2025 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/MutualFundsAct2025Revision_1739307105.pdf"
    effectiveDate: "2025-02-11"

  - id: cima-private-funds
    name: "Private Funds Act (2025 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1739307005.pdf"
    effectiveDate: "2025-02-11"

  - id: cima-securities
    name: "Securities Investment Business Act (2020 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/1579810300SecuritiesInvestmentBusinessLaw2020Revision_1579810300_1599485102.pdf"
    effectiveDate: "2020-01-23"

  - id: cima-insurance
    name: "Insurance Act (2010)"
    url: "https://www.cima.ky/upimages/lawsregulations/1499345418InsuranceLaw2010_1599481339.pdf"
    effectiveDate: "2010-11-01"

  - id: cima-aml
    name: "Anti-Money Laundering Regulations (2025 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/Anti-MoneyLaunderingRegulations2025Revision,LG6,S1_1738770781.pdf"
    effectiveDate: "2025-02-06"

  - id: cima-vasp
    name: "Virtual Asset (Service Providers) Act (2024 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/VirtualAssetServiceProvidersAct2024Revision_1716397271.pdf"
    effectiveDate: "2024-05-22"

  - id: cima-proceeds-crime
    name: "Proceeds of Crime Act (2024 Revision)"
    url: "https://www.cima.ky/upimages/lawsregulations/ProceedsofCrimeAct_2024Revision_1713968966.pdf"
    effectiveDate: "2024-04-24"

  - id: cima-beneficial-ownership
    name: "Beneficial Ownership Transparency Act (2023)"
    url: "https://www.cima.ky/upimages/lawsregulations/BeneficialOwnershipTransparencyAct,2023_1705419742.pdf"
    effectiveDate: "2023-01-17"
```

## Extractor Extensions

### Dollar amount extraction

Add to `packages/fetcher/src/extractors/fine-amount.ts`:

```typescript
// Existing EUR pattern
const EUR_AMOUNT = /(?:EUR|€)\s*([\d]+(?:[\s,\.][\d]+)*)\s*(million|m)?/gi;

// NEW: Common-law dollar amount (Cayman, Bermuda, etc.)
const DOLLAR_AMOUNT = /(\d[\d,]*)\s+dollars/gi;
const DOLLAR_WORD = /(?:fine|penalty)\s+(?:of\s+)?(?:not exceeding\s+)?([\w\s,]+?)\s+dollars/gi;
```

The extractor emits `fine_amount_kyd` for dollar matches when the legislation's jurisdiction is `KY`. The `extract_type` enum needs extending:

```sql
ALTER TYPE extract_type ADD VALUE 'fine_amount_kyd';
ALTER TYPE extract_type ADD VALUE 'imprisonment_term';
```

### Imprisonment term extraction

New extractor `packages/fetcher/src/extractors/imprisonment.ts`:

```typescript
const IMPRISONMENT = /imprisonment\s+for\s+([\w\s]+?)(?:\.|,|;|and)/gi;

export function extract(text: string, articleId: string): ParsedExtract[] {
  // Matches "imprisonment for two years", "imprisonment for six months"
}
```

## CLI Changes

```bash
# PDF ingest (ad-hoc)
lexius-fetch ingest --source pdf --url <pdf_url> --legislation <id>

# CIMA registry ingest (all 10 acts)
lexius-fetch ingest --source cima

# CIMA single act
lexius-fetch ingest --source cima --legislation cima-vasp

# Existing CELLAR ingest (unchanged)
lexius-fetch ingest --celex 32024R1689 --legislation eu-ai-act
```

The `--celex` flag implies `--source cellar`. When `--source` is set, `--celex` is ignored.

## Ingest Refactor

```typescript
// packages/fetcher/src/ingest.ts (refactored)

export async function ingest(
  db: Database,
  config: SourceConfig | CellarConfig,
  embedder?: EmbeddingService,
): Promise<IngestResult> {
  const adapter = createAdapter(config);
  const parsed = await adapter.fetch(config);

  // Everything below is identical to today — upsert articles,
  // hash comparison, embedding generation, extract pass
}
```

The adapter produces `ParsedRegulation` — the same type the XHTML parser produces. The ingest pipeline doesn't know or care whether the source was PDF or XHTML.

## Migration

`0005_offshore_extract_types.sql`:

```sql
ALTER TYPE extract_type ADD VALUE IF NOT EXISTS 'fine_amount_kyd';
ALTER TYPE extract_type ADD VALUE IF NOT EXISTS 'imprisonment_term';
```

## Testing Strategy

### Unit
- Section parser: fixture text from each of the 3 tested CIMA acts. Assert section count, section numbers, body length.
- **Title/body merge test**: fixture with duplicate section numbers → assert single merged section with title from first, body from second.
- **Dynamic header detection test**: fixture with act title on page 1 → assert header lines are filtered from section bodies.
- **Huge section test**: fixture with a 15K-char definitions section → assert it's accepted as a single section, not split.
- PdfAdapter: mock pdfjs-dist, verify text extraction + section parsing chain.
- Dollar amount extractor: "fine of ten thousand dollars" → 10000; "fine of one hundred thousand dollars" → 100000.
- Imprisonment extractor: "imprisonment for two years" → { term: "two years" }.

### Integration
- Download + parse the Monetary Authority Act. Assert **60-70 sections** (post-merge, post-header-filter — raw is 120, ~46 duplicates, ~19 leaked headers).
- Ingest into test DB. Assert `articles` table has rows with `source_format = 'pdf'`.
- Run the existing extractor. Assert `article_extracts` has `fine_amount_kyd` rows.
- **Cross-act test**: ingest all 10 CIMA acts. Assert total ~750-800 sections (raw 1,228 minus ~471 duplicates and header leaks).

### Simulation regression
- Run `scripts/simulate-cima.ts` after implementation. Assert:
  - Zero duplicate section numbers per act
  - Zero leaked page headers
  - Section count within 10% of expected (~750-800)
  - 254+ penalty-bearing sections

### E2E
- Agent test: "What are the penalties under the CIMA Monetary Authority Act?" → should cite specific sections with dollar amounts.

## Specflow Contract (lands with implementation)

```yaml
contract_meta:
  id: offshore_adapters
  version: 1
  created_from_spec: "PRD-012 / ARD-016 / DDD-015 — offshore PDF source adapter"
  covers_reqs:
    - OFFSHORE-001
    - OFFSHORE-002
  owner: "legal-ai-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: offshore_adapters"

rules:
  non_negotiable:
    - id: OFFSHORE-001
      title: "PDF adapter must not use LLM for text extraction"
      scope:
        - "packages/fetcher/src/adapters/pdf.{ts,js}"
        - "packages/fetcher/src/parsers/section-parser.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /from\s+['"](?:@anthropic-ai\/sdk|openai)/
            message: "PDF text extraction must be deterministic — no LLM"

    - id: OFFSHORE-002
      title: "PDF-sourced sections must be AUTHORITATIVE"
      scope:
        - "packages/fetcher/src/adapters/pdf.{ts,js}"
        - "packages/fetcher/src/ingest.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /sourceFormat.*pdf|source_format.*pdf/
            message: "PDF adapter must set source_format to 'pdf' so provenance tracking distinguishes PDF from XHTML sources"

    - id: OFFSHORE-003
      title: "Section parser must merge duplicate section numbers"
      scope:
        - "packages/fetcher/src/parsers/section-parser.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /merge|deduplicate|same.*number/
            message: "Common-law PDFs repeat section numbers for title and body — the parser must detect and merge consecutive entries with the same number"

    - id: OFFSHORE-004
      title: "Section parser must detect and filter act-specific page headers"
      scope:
        - "packages/fetcher/src/parsers/section-parser.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /detectActTitle|actTitle|dynamicHeader|header.*detect/
            message: "Each CIMA PDF has the act name as a page header on every page — the parser must detect this from page 1 and filter it dynamically"
```

## Rollout Order

1. Source adapter interface + `PdfAdapter` + `pdfjs-dist` dependency
2. Common-law section parser + tests
3. CIMA registry YAML
4. Refactor `ingest.ts` to accept `SourceConfig`
5. CLI `--source` flag
6. Dollar amount + imprisonment extractors + migration 0005
7. Ingest all 10 CIMA acts
8. Seed CIMA legislation metadata + register GenericPlugin
9. Test with the agent
10. Contract `offshore_adapters.yml`

## Open Questions

- Whether to store the original PDF as a blob (for re-extraction without re-download). Deferred — URLs are stable.
- Whether CIMA dollar amounts should convert to EUR for cross-jurisdiction comparison. Deferred — keep native currency.
- Whether to parse Schedules/Appendices (some CIMA acts have them). Deferred — main sections first.
