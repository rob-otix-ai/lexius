# ARD-017: Curator Workflow — Live CURATED-Tier Editing

## Status: Accepted
## Date: 2026-04-20

---

## Context

PRD-013 requires a live curator workflow for CURATED-tier facts. The schema already carries `curated_by` and `reviewed_at` columns (PROV-001/003), but no code path mutates them after seed. The curator story is real in the data model and absent from the runtime.

The key constraints:

- AUTHORITATIVE rows must remain immutable and hash-verified. Nothing in this feature touches them.
- CURATED rows must carry accurate attribution at all times — `curated_by` and `reviewed_at` are always the most recent human reviewer.
- Every CURATED mutation must remain consistent with verbatim law (cross-check still green) and with semantic search (embedding still valid).
- Every CURATED mutation must be reversible, attributable, and fully auditable.
- The pattern must generalise to four more entity types (penalties, deadlines, FAQ, risk-categories) and to two more client surfaces (MCP, agent write paths, wiki) without rework.

## Decision

### 1. Single write path: use-case layer with transactional guarantees

Every curator mutation — create, update, deprecate, revert — flows through a use case in `@lexius/core/src/use-cases/`. The use case runs in one DB transaction and performs four steps:

1. Load the target row with its current `row_version`.
2. Validate: `If-Match` matches, tier transition allowed, `reason` non-empty, `derivedFrom` not mutated on CURATED.
3. Run domain services: cross-check (if numeric fields change), re-embed (if text fields change).
4. Write: row update + `curator_edits` insert + embedding update, all in the same transaction.

If any step fails, the transaction rolls back. No half-state possible. The `curator_audit.yml` contract enforces that no raw `UPDATE obligations` exists outside this layer.

**Rejected alternatives:**

- **API-layer write with background audit job.** Loses atomicity — we can produce a row change with no audit row on crash. Unacceptable given the "we record who edited this" claim.
- **Triggers in Postgres for audit.** Works for audit but cannot enforce cross-check or re-embedding cheaply, and puts business logic in SQL. Use case in TypeScript stays readable and testable.
- **Event sourcing (row rebuilt from events).** Cleaner but reshapes every read path. Enormous scope. Not worth it against a mutable row + append-only audit.

### 2. Optimistic concurrency via `row_version` column + `If-Match` header

Obligations gain a `row_version INT NOT NULL DEFAULT 1`, incremented on every write. Curator write routes require `If-Match: <row_version>`. Mismatch returns HTTP 409 with the current row in the body.

**Rejected alternatives:**

- **ETag from hash of row fields.** Same effect, more CPU per read, harder to debug.
- **Advisory locks on `entity_id`.** Serialises curator edits pessimistically; kills concurrency.
- **Last-write-wins.** Silent data loss. Never acceptable.

### 3. Append-only `curator_edits` table with full attribution

One row per mutation. Columns: `entity_type`, `entity_id`, `editor_id`, `editor_ip`, `editor_ua`, `source` (`cli | agent | mcp | skill | wiki`), `action` (`create | update | revert | deprecate`), `old_values jsonb`, `new_values jsonb`, `row_version_before`, `row_version_after`, `reason` (CHECK length > 0), `cross_check_result jsonb`, `edited_at`.

No `DELETE` path in application code. The table is the truth record for the "we record who they are" claim.

**Rejected:** separate audit-per-entity tables. Querying "show me everything curator X touched this week" becomes a UNION across five tables. Single table is simpler and cheaper.

### 4. API key role column, not a separate curator-keys table

The existing `api_keys` table gains `role text NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'curator'))`. Auth middleware reads the role and gates curator routes.

**Rejected:** new `curator_keys` table with a link to `api_keys`. Doubles the auth complexity for no real gain. A single table keeps the code path readable and reusable.

**Forward compatibility:** `role` is `text` (not boolean) so per-jurisdiction scopes (`curator:eu`, `curator:cima`) are a zero-migration upgrade. Enforcement comes later.

### 5. Credentials file over environment variables, with env as escape hatch

Curator keys are long-lived and write-capable. Storing them in `.env` or shell history is a bad default. Credentials live in `~/.config/lexius/credentials` (TOML, mode 600, Windows falls back to `%APPDATA%\lexius\credentials`, respects `XDG_CONFIG_HOME`).

A shared package `@robotixai/lexius-credentials` resolves in order:

```
--profile flag  →  LEXIUS_PROFILE env  →  [default] section
                   env overrides (LEXIUS_API_URL / LEXIUS_API_KEY / LEXIUS_CURATOR_ID) always win
```

All four surfaces (CLI, agent, MCP, skills) import the same package. Only the CLI writes to the file.

**Rejected:** env-only. Human curators have long-running sessions across four surfaces. File-based credentials make rotation, profile switching, and audit attribution clean. `gh`, `aws`, `gcloud`, `anthropic` all converged on this pattern.

### 6. Paste-a-key login, not browser OAuth (v1)

`lexius-curate login --key lx_curator_...` writes the key to the credentials file. Key generation is an admin operation: `pnpm create-api-key --role curator --owner <email>` extends the existing script.

**Rejected for v1:** browser OAuth. Cleaner UX but needs a login page, callback handling, CSRF protection, none of which exist today. Curator audience is 1–5 people initially. Paste-a-key ships fast and matches how the rest of Lexius already handles API keys.

Browser flow lands when a curator admin UI exists.

### 7. Dry-run is a first-class API parameter, not a CLI-only flag

Every write route accepts `?dry_run=true`. The server runs the full validation pipeline (cross-check, embedding, tier transition, audit preview) and returns what would happen, without writing. The CLI defaults to `--dry-run` when a curator key is present without an explicit `--apply`.

This is the foundation for the v1.1 MCP two-phase propose/commit tools: propose returns the dry-run response plus a commit token, commit writes. The token encodes the exact proposed change; if row state drifted since propose, commit is rejected.

**Rejected:** dry-run as CLI-only feature. Means agent/MCP/wiki reimplement preview logic. Server-side is the only honest place for it.

### 8. Dynamic MCP tool listing filtered by role

The MCP server (`@robotixai/lexius-mcp`) reads credentials on every `tools/list` call. Reader-role keys see the 13 existing read tools. Curator-role keys see curator tools as well. No credentials → read tools only.

**Consequence:** if the user has not logged in as a curator, the model cannot see — let alone call — write tools. Defense in depth beyond the role-gated auth middleware.

**Rejected:** static tool list with runtime 403s. Model sees tools it cannot use, wastes tokens attempting them, and leaks information about what capabilities exist. Dynamic listing is cheaper and safer.

### 9. Verbatim-law drift flagging, not cascade invalidation

When fetcher ingests an article with a changed `source_hash`, all CURATED obligations whose `derivedFrom` contains that article get `needs_review = true` and `stale_since = now()`. They remain valid to return from the API — just flagged.

A `GET /api/v1/curate/queue` endpoint exposes the stale set. Curators triage, re-review, and either update the obligation (which clears the flag) or confirm it's still correct (explicit "review, no change" edit).

**Rejected:** auto-invalidate (remove obligation from query results until re-reviewed). Destroys UX for readers, creates a race where the curator hasn't yet reviewed a benign amendment. Flag-and-surface is kinder.

**Rejected:** silent drift (do nothing). Undermines the provenance claim.

### 10. Seed idempotency via `curated_by` ownership gate

Seed inserts become `ON CONFLICT (id) DO NOTHING WHERE curated_by = 'seed:rob'`. Any row whose `curated_by` has changed to a real curator is owned by that human — seed does not touch it.

Integration test: seed → PATCH via API → reseed → row unchanged, audit log still has one edit.

**Rejected:** seeds become strictly first-run-only. Works today but loses the ability to add new curated obligations via code for regulations whose expert hasn't signed up yet. Ownership gate preserves both workflows.

### 11. Wiki-level editing lands in v1.2, API is already ready

`@robotixai/wikivault` v0.1 is a one-way projection (DB → vault). In v1.2, wikivault gains bidirectional mode: a file-watcher that translates markdown diffs into `@robotixai/lexius-curate` PATCH calls, with `row_version` and `entity_id` round-tripped via frontmatter.

This decision is made in v1 so the PATCH response shape is stable: every write returns `{ row_version, cross_check_result, embedding_regenerated }`. Wikivault consumes these in v1.2 with no API change required.

**Consequence:** DB remains canonical. Wikivault is a two-way client, not a store. Any vault file that diverges can be re-exported losslessly from the DB.

### 12. Immutable `derivedFrom` for CURATED rows in v1

Curators cannot change which articles an obligation derives from. Only the fetcher (or a deliberate re-seed) can alter `derivedFrom`. Rationale: `derivedFrom` is how PROV-003 and the derivation-chain use case work. A curator freely mutating it corrupts the derivation graph silently.

**Rejected for v1:** allow `derivedFrom` edits behind a cross-article integrity check. Real requirement, not urgent, punted to a later branch.

## Consequences

**Positive:**

- The LinkedIn claim becomes true. A named domain expert can edit CURATED facts end-to-end, and we can prove who did what via `curator_edits`.
- The pattern generalises to four more entity types with no architectural change — only use-case duplication.
- Wiki-level editing lands cheaply because the API already guarantees correctness.
- `@robotixai/lexius-credentials` is a reusable building block for charity, trading, and any other Rob-otix product that needs scoped API auth.

**Negative / watchpoints:**

- Adds real complexity to the API layer (auth roles, dry-run, If-Match, audit enforcement).
- Cross-check running synchronously in the write path adds latency to every PATCH. Measured impact: single-digit milliseconds on the observed penalty set, tolerable.
- Re-embedding on every text edit is an OpenAI call per edit. Budgetable but non-zero. A local fallback via the harness's Ollama provider is a plausible future optimisation.
- The `curator_edits` table grows unbounded. Retention policy (archive after N years) is a v2 concern; not a blocker for v1 because growth is human-paced.

## Related

- PRD-013: Curator Workflow
- DDD-016: Curator Workflow Implementation
- ARD-011: Provenance Architecture (provides the tier model this feature mutates)
- ARD-012: Deterministic Extractor (provides the cross-check service this feature calls synchronously)
- ARD-013: Claude Integration (provides `api_keys` schema this feature extends)
