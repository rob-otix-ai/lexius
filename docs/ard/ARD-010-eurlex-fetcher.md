# ARD-010: EUR-Lex Fetcher Architecture

## Status: Accepted
## Date: 2026-04-16

---

## Context

We need authoritative regulation text. The EUR-Lex public website (`eur-lex.europa.eu`) blocks bots with HTTP 202 challenges. The Publications Office CELLAR API (`publications.europa.eu/resource/celex/{CELEX}`) is open, unauthenticated, and returns machine-readable content via HTTP content negotiation.

## Decision

### 1. New Package: `@lexius/fetcher`

Separate package, pure infrastructure, publishable as `@lexius/fetcher` on npm.

- Dependencies: `fast-xml-parser` (Formex parsing), `cheerio` (XHTML fallback), `@lexius/db` (schema), `@lexius/logger` (logging)
- Does NOT depend on `@lexius/core` (fetcher doesn't need domain logic)
- CLI binary: `lexius-fetch`

### 2. CELLAR REST with Content Negotiation

Base URL: `https://publications.europa.eu/resource/celex/{CELEX}`

Primary format: XHTML (ELI-tagged, `application/xhtml+xml`) — simpler to parse than Formex, single file.
- Articles identified by `<p class="oj-ti-art">Article N</p>`
- Paragraphs: `<p class="oj-normal">`, `<p class="oj-ti-grseq-1">`, `<p class="oj-ti-section-1">`, etc.

Optional future: Formex XML (`application/zip`) — cleanest structure but multi-file zip, more complex parse. Deferred to P1.

Headers:
- `Accept: application/xhtml+xml`
- `Accept-Language: eng`
- `User-Agent: lexius-fetcher/0.1 (+https://github.com/rob-otix-ai/lexius)`

Follows 303 redirect to manifestation URL automatically.

### 3. Parser Strategy

For XHTML:
1. Load with cheerio
2. Find all `<p class="oj-ti-art">` nodes → article boundaries
3. Extract article number from the text content ("Article N")
4. Extract article title from the following `<p class="oj-sti-art">`
5. Extract body by walking siblings until the next `oj-ti-art` or end of section
6. Clean HTML — strip inline markers, preserve paragraph breaks as `\n\n`
7. Hash the body text (SHA-256) for change detection

### 4. Provenance Schema Additions

Add columns to `articles` table:
- `sourceUrl: text` — the CELLAR URL fetched from (already exists, reuse)
- `sourceFormat: varchar(16) nullable` — "xhtml" | "fmx4"
- `sourceHash: varchar(64) nullable` — SHA-256 hex of body text
- `fetchedAt: timestamp nullable` — when last fetched
- `verbatim: boolean default false` — true if text came from fetcher, false if paraphrase

A migration adds these columns. Existing rows get `verbatim: false` by default.

### 5. Separation of Concerns

**Fetcher owns:** articles (verbatim regulation text)
**Seeds still own:** legislation metadata, risk categories, obligations, penalties, deadlines, FAQ

Rationale: the regulation text is authoritative. The interpretive layer (obligations, risk tiers) is our curation — labelled as such.

### 6. Idempotency

```
For each article in the fetched regulation:
  existing = db.query(articles where legislationId = X AND number = N)
  newHash = sha256(parsedText)
  if !existing OR existing.sourceHash !== newHash:
    upsert with new text + hash + fetchedAt + sourceFormat = "xhtml" + verbatim=true
    log "article X updated"
    (embedding regen happens in a separate pass, triggered by seed --refresh-embeddings)
  else:
    skip
```

Embedding generation is decoupled: the fetcher only writes text + hash. A separate `refresh-embeddings` step (can be part of seed) regenerates vectors where `fetchedAt > embeddingGeneratedAt` or where embedding is null.

### 7. Error Handling

- 429/503 → exponential backoff, 3 retries
- 404 → CELEX not found, fail with clear message
- Parse failure → log the problematic HTML chunk, skip the article, continue with the rest
- Partial success is acceptable — record what was fetched, what failed

## Consequences

### Positive

- Regulation text is authoritative and cite-able
- Change detection enables amendment tracking
- Adding a new regulation becomes a 1-line command (just needs CELEX)
- Separation from curated content is clear in the data model (`verbatim` flag)

### Negative

- Adds an npm dependency (cheerio ~500KB)
- Initial fetch is slow (1.2 MB HTML → parse → 113 article writes)
- XHTML format can change — parser may need updates
- Annex extraction not in P0 (requires different parsing)

### Mitigations

- Cheerio is battle-tested and tree-shakable
- Fetch is a one-time operation, not per-request
- XHTML structure has been stable since ~2015 (Office of Publications document)
- Annex parsing spec'd for P1

## Alternatives Considered

1. **Scrape `eur-lex.europa.eu`** — rejected; HTTP 202 anti-bot blocking
2. **Use SPARQL endpoint exclusively** — rejected; better for metadata discovery, not body text
3. **Commit pre-fetched XHTML files to the repo** — rejected; versioning + auditability better served by live fetch with change detection
4. **Integrate into `@lexius/db`** — rejected; fetcher has different dependencies (HTTP, HTML parsing) that shouldn't pollute the DB package
