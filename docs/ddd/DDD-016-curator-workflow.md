# DDD-016: Curator Workflow — Implementation

## Status: Draft
## Date: 2026-04-20

---

## Overview

Implementation details for PRD-013 / ARD-017. Covers: schema migration, domain services, use cases, API routes, credentials package, CLI package, contracts, and the exit-criterion test. All changes scoped to `obligations` in v1.

## Package Structure (additions)

```
packages/
├── core/src/
│   ├── use-cases/
│   │   ├── create-curated-obligation.ts           # NEW
│   │   ├── update-curated-obligation.ts           # NEW
│   │   ├── deprecate-curated-obligation.ts        # NEW
│   │   ├── revert-curator-edit.ts                 # NEW
│   │   ├── list-curator-edits.ts                  # NEW
│   │   └── mark-stale-by-article.ts               # NEW (called by fetcher)
│   ├── domain/
│   │   ├── services/
│   │   │   └── cross-check.ts                     # NEW (extracted from scripts/extractor-crosscheck.ts)
│   │   └── value-objects/
│   │       ├── tier-transition.ts                 # NEW (9-cell matrix)
│   │       └── curator-edit.ts                    # NEW
│   └── ports/
│       └── embedding-service.ts                   # existing, reused
│
├── db/src/
│   ├── migrations/
│   │   └── 0005_curator_workflow.sql              # NEW
│   ├── schema/
│   │   ├── curator-edits.ts                       # NEW
│   │   ├── api-keys.ts                            # MODIFIED (add role column)
│   │   └── obligations.ts                         # MODIFIED (add row_version, needs_review, stale_since, deprecated_*)
│   └── seeds/
│       └── helpers/
│           └── upsert.ts                          # NEW (ON CONFLICT ... WHERE curated_by = 'seed:rob')
│
├── api/src/
│   ├── routes/
│   │   └── curate.ts                              # NEW (all /api/v1/curate/* routes)
│   ├── middleware/
│   │   └── require-curator-role.ts                # NEW
│   └── dto/
│       └── curator-edit.ts                        # NEW
│
├── credentials/                                   # NEW PACKAGE
│   ├── package.json                               # @robotixai/lexius-credentials
│   └── src/
│       ├── index.ts                               # loadCredentials, requireCurator
│       ├── file-store.ts                          # TOML read/write
│       └── resolver.ts                            # precedence chain
│
├── curate-cli/                                    # NEW PACKAGE
│   ├── package.json                               # @robotixai/lexius-curate
│   └── src/
│       ├── commands/
│       │   ├── login.ts
│       │   ├── logout.ts
│       │   ├── whoami.ts
│       │   ├── obligations/
│       │   │   ├── list.ts
│       │   │   ├── create.ts
│       │   │   ├── edit.ts
│       │   │   ├── deprecate.ts
│       │   │   └── history.ts
│       │   ├── my-edits.ts
│       │   └── revert.ts
│       └── index.ts
│
├── mcp/src/                                       # MODIFIED
│   └── server.ts                                  # tools/list filtered by role
│
└── fetcher/src/
    └── ingest.ts                                  # MODIFIED (calls markStaleByArticle on source_hash change)
```

## Schema Migration — `0005_curator_workflow.sql`

```sql
-- 0005_curator_workflow.sql
-- PRD-013 / ARD-017 — live CURATED-tier editing surface

-- 1. api_keys gains a role column
ALTER TABLE api_keys
  ADD COLUMN role text NOT NULL DEFAULT 'reader'
    CHECK (role IN ('reader', 'curator'));

CREATE INDEX api_keys_role_idx ON api_keys(role);

-- 2. obligations gains concurrency + staleness + soft-delete columns
ALTER TABLE obligations
  ADD COLUMN row_version int NOT NULL DEFAULT 1,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN stale_since timestamptz,
  ADD COLUMN deprecated_at timestamptz,
  ADD COLUMN deprecated_reason text;

CREATE INDEX obligations_needs_review_idx
  ON obligations(needs_review, stale_since) WHERE needs_review = true;

-- 3. curator_edits — append-only audit log
CREATE TABLE curator_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('obligation')),
  entity_id varchar NOT NULL,
  editor_id text NOT NULL,
  editor_ip inet,
  editor_ua text,
  source text NOT NULL CHECK (source IN ('cli', 'agent', 'mcp', 'skill', 'wiki', 'api')),
  action text NOT NULL CHECK (action IN ('create', 'update', 'revert', 'deprecate')),
  old_values jsonb,
  new_values jsonb NOT NULL,
  row_version_before int,
  row_version_after int NOT NULL,
  reason text NOT NULL CHECK (length(reason) > 0),
  cross_check_result jsonb,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX curator_edits_entity_idx ON curator_edits(entity_type, entity_id);
CREATE INDEX curator_edits_editor_idx ON curator_edits(editor_id);
CREATE INDEX curator_edits_edited_at_idx ON curator_edits(edited_at DESC);

-- 4. prevent DELETE from application code via restrictive privilege
REVOKE DELETE ON curator_edits FROM PUBLIC;
```

## Domain Layer

### Tier Transition Matrix

```typescript
// packages/core/src/domain/value-objects/tier-transition.ts

import type { ProvenanceTier } from "./provenance-tier.js";

const ALLOWED: Record<ProvenanceTier, ProvenanceTier[]> = {
  AUTHORITATIVE: [],                                // immutable
  AI_GENERATED:  ["AI_GENERATED", "CURATED"],       // promotion allowed
  CURATED:       ["CURATED"],                       // stays CURATED
};

export function assertTierTransition(from: ProvenanceTier, to: ProvenanceTier): void {
  if (!ALLOWED[from].includes(to)) {
    throw new TierTransitionForbidden(from, to);
  }
}

export class TierTransitionForbidden extends Error {
  constructor(from: ProvenanceTier, to: ProvenanceTier) {
    super(`Tier transition ${from} → ${to} is not permitted`);
  }
}
```

### Cross-Check Domain Service

Extract the logic in `scripts/extractor-crosscheck.ts` into a pure domain service so the update use case can call it synchronously. The script becomes a thin CLI wrapper around the service.

```typescript
// packages/core/src/domain/services/cross-check.ts

export interface CrossCheckInput {
  entityType: "obligation" | "penalty";
  derivedFrom: string[];
  proposedValues: Record<string, unknown>;
}

export interface CrossCheckResult {
  ok: boolean;
  mismatches: Mismatch[];
}

export interface CrossCheckService {
  run(input: CrossCheckInput): Promise<CrossCheckResult>;
}
```

Concrete implementation in `@lexius/infra` reads from `article_extracts` via the Drizzle repository.

### UpdateCuratedObligation Use Case

```typescript
// packages/core/src/use-cases/update-curated-obligation.ts

export interface UpdateCuratedObligationInput {
  obligationId: string;
  rowVersion: number;              // from If-Match header
  editorId: string;
  editorIp?: string;
  editorUa?: string;
  source: "cli" | "agent" | "mcp" | "skill" | "wiki" | "api";
  reason: string;
  changes: Partial<ObligationMutableFields>;
  targetTier?: "CURATED";          // only transition target allowed from update
  dryRun?: boolean;
}

export class UpdateCuratedObligation {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly embeddings: EmbeddingService,
    private readonly crossCheck: CrossCheckService,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: UpdateCuratedObligationInput): Promise<UpdateResult> {
    return this.uow.transactional(async (tx) => {
      const current = await this.obligations.findById(tx, input.obligationId);

      if (!current) throw new ObligationNotFound(input.obligationId);
      if (current.provenanceTier === "AUTHORITATIVE") throw new AuthoritativeImmutable();
      if (current.rowVersion !== input.rowVersion) throw new RowVersionMismatch(current.rowVersion);
      if (!input.reason?.length) throw new ReasonRequired();
      if ("derivedFrom" in input.changes) throw new DerivedFromImmutable();

      const nextTier = input.targetTier ?? current.provenanceTier;
      assertTierTransition(current.provenanceTier, nextTier);

      if (touchesNumericFields(input.changes)) {
        const check = await this.crossCheck.run({
          entityType: "obligation",
          derivedFrom: current.derivedFrom,
          proposedValues: { ...current, ...input.changes },
        });
        if (!check.ok) throw new CrossCheckFailed(check.mismatches);
      }

      let newEmbedding = current.embedding;
      if (touchesTextFields(input.changes)) {
        newEmbedding = await this.embeddings.embed(buildEmbeddingInput(current, input.changes));
      }

      if (input.dryRun) {
        return { dryRun: true, wouldApply: input.changes, crossCheckOk: true };
      }

      const updated = await this.obligations.update(tx, {
        ...current,
        ...input.changes,
        embedding: newEmbedding,
        provenanceTier: nextTier,
        curatedBy: input.editorId,
        reviewedAt: this.clock.now(),
        rowVersion: current.rowVersion + 1,
        needsReview: false,      // clear stale flag on edit
        staleSince: null,
      });

      await this.audit.insert(tx, {
        entityType: "obligation",
        entityId: current.id,
        editorId: input.editorId,
        editorIp: input.editorIp,
        editorUa: input.editorUa,
        source: input.source,
        action: "update",
        oldValues: serialise(current),
        newValues: serialise(updated),
        rowVersionBefore: current.rowVersion,
        rowVersionAfter: updated.rowVersion,
        reason: input.reason,
        crossCheckResult: { ok: true },
        editedAt: this.clock.now(),
      });

      return { dryRun: false, updated };
    });
  }
}
```

The other five use cases (`Create`, `Deprecate`, `Revert`, `ListEdits`, `MarkStaleByArticle`) follow the same shape. `Revert` reads the target audit row, constructs a new update with its `old_values` as changes, and sets `action = 'revert'` on the new audit row.

### Anchoring invariant — non-empty, resolvable `derivedFrom`

Every CURATED obligation must cite at least one existing article. Extraction is the core; curator prose is the interpretation of extracted verbatim law. A curator cannot author an orphan interpretation.

Enforced by `C-INT-007` in two places:

1. **`CreateCuratedObligation`** rejects input with empty `derivedFrom`, then verifies every ID resolves to a row in `articles` — inside the same transaction as the insert so a race cannot slip an orphan in.
2. **`UpdateCuratedObligation`** already treats `derivedFrom` as immutable on CURATED (`C-INT-004`), and additionally rejects any update that would leave `derivedFrom` empty (defence against later schema changes that make the column nullable).

```typescript
// packages/core/src/use-cases/create-curated-obligation.ts

if (!input.derivedFrom?.length) throw new DerivedFromRequired();
await assertDerivedFromResolves(tx, input.derivedFrom);   // SELECT 1 FROM articles WHERE id = ANY($1)
```

Error surfaces: `DerivedFromRequired` → HTTP 422 with `{ error: "derived_from_required" }`. `DerivedFromUnresolved(missing[])` → HTTP 422 with `{ error: "derived_from_unresolved", missing: [...] }` so the CLI can show the curator exactly which article IDs don't exist.

## API Routes

All routes in `packages/api/src/routes/curate.ts`, all mounted under `/api/v1/curate`, all guarded by `requireCuratorRole` middleware.

```
POST   /api/v1/curate/obligations
PATCH  /api/v1/curate/obligations/:id           If-Match required, ?dry_run=true supported
DELETE /api/v1/curate/obligations/:id           soft-delete via deprecate, requires reason
POST   /api/v1/curate/obligations/:id/revert    body: { edit_id, reason }
GET    /api/v1/curate/edits                     query: entity_type, editor_id, since
GET    /api/v1/curate/queue                     obligations where needs_review = true
GET    /api/v1/curate/whoami                    returns { editor_id, role, profile }
```

### `requireCuratorRole` middleware

```typescript
export function requireCuratorRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.apiKey?.role !== "curator") {
    res.status(403).json({
      error: "curator_role_required",
      message: "This route requires a curator-scoped API key.",
    });
    return;
  }
  next();
}
```

### PATCH response shape (stable contract — wikivault v1.2 consumer)

```json
{
  "id": "eu-ai-act-art-99-provider",
  "row_version": 4,
  "provenance": { "tier": "CURATED", "curated_by": "rob@fall.dev", "reviewed_at": "..." },
  "embedding_regenerated": true,
  "cross_check_result": { "ok": true, "mismatches": [] },
  "audit_edit_id": "9f3c..."
}
```

## Dynamic MCP Tool Listing

```typescript
// packages/mcp/src/server.ts — tools/list handler

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const role = await resolveCurrentRole();   // reads credentials file per-request
  const tools = [...READ_TOOLS];
  if (role === "curator") tools.push(...CURATOR_TOOLS);
  return { tools };
});
```

`CURATOR_TOOLS` contains `lexius_curate_propose_update_obligation` and `lexius_curate_commit` (v1.1). In v1, `CURATOR_TOOLS` is empty and the filtering is a no-op — but the code path is in place, so v1.1 adds two entries with no other changes.

## `@robotixai/lexius-credentials`

```typescript
// packages/credentials/src/index.ts

export interface Credentials {
  apiUrl: string;
  apiKey: string;
  curatorId?: string;
  role: "reader" | "curator";
  profile: string;
  expiresAt?: Date;
}

export function loadCredentials(options?: { profile?: string }): Credentials | null;
export function requireCurator(options?: { profile?: string }): Credentials;  // throws if not curator
```

Zero runtime dependencies. TOML parsing via a ~50-line hand-rolled parser (the file is simple enough).

File location resolution:

```
process.env.LEXIUS_CREDENTIALS_FILE
  → $XDG_CONFIG_HOME/lexius/credentials
  → ~/.config/lexius/credentials           (unix)
  → %APPDATA%\lexius\credentials            (windows)
```

Precedence:

```
--profile flag → LEXIUS_PROFILE env → [default] section
env overrides always win: LEXIUS_API_URL, LEXIUS_API_KEY, LEXIUS_CURATOR_ID
```

## `@robotixai/lexius-curate` CLI

Single-file entry in `packages/curate-cli/src/index.ts`, subcommands in `commands/`. Uses Commander (already in monorepo). Reads credentials via `@robotixai/lexius-credentials`.

Key commands:

```
lexius-curate login --key lx_curator_...             # writes credentials file, verifies via /whoami
lexius-curate logout [--profile <name>]
lexius-curate whoami

lexius-curate obligations list --stale               # /api/v1/curate/queue
lexius-curate obligations edit <id> [--apply]        # opens $EDITOR on JSON; default --dry-run
lexius-curate obligations create [--apply]
lexius-curate obligations deprecate <id> --reason "..." [--apply]
lexius-curate obligations history <id>

lexius-curate my-edits [--since <date>] [--json]
lexius-curate revert <edit_id> --reason "..." [--apply]
```

All write commands default to dry-run and require `--apply` to actually mutate. Dry-run output shows the diff, cross-check result, and embedding-regen signal.

`edit`/`create` use `$EDITOR` (fallback to `vim`) on a temporary JSON file. On save, the CLI diffs against the server's current view and submits a PATCH. Conflict handling: if `row_version` drifted between fetch and PATCH, CLI pulls current, re-opens editor with a merge view.

## Seed Idempotency

Replace `db.insert(obligations).values(...).onConflictDoNothing()` with a helper:

```typescript
// packages/db/src/seeds/helpers/upsert.ts

export async function seedIfUnowned<T extends { id: string; curatedBy?: string }>(
  tx: Transaction,
  table: PgTable,
  row: T,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO ${table} (${sql.raw(columnList)}) VALUES (${sql.raw(valueList)})
    ON CONFLICT (id) DO UPDATE
      SET ${sql.raw(updateList)}
      WHERE ${table}.curated_by = 'seed:rob'
  `);
}
```

Effect: a first-time seed inserts. A reseed over a seed-owned row updates. A reseed over a curator-owned row (any `curated_by != 'seed:rob'`) does nothing. Integration test verifies all three cases.

## Fetcher Staleness Hook

```typescript
// packages/fetcher/src/ingest.ts — after article upsert

if (previousHash && previousHash !== newHash) {
  const affected = await markStaleByArticle.execute({
    articleId: article.id,
    staleSince: new Date(),
  });
  logger.info({ article: article.id, affected }, "Flagged curated obligations needs_review");
}
```

`MarkStaleByArticle` use case updates `needs_review = true`, `stale_since = now()` on every obligation whose `derivedFrom @> ARRAY[articleId]`.

## Specflow Contracts

Four contracts:

1. **`curator_audit.yml`** — every CURATED mutation writes exactly one audit row in the same transaction, the audit row's `new_values` round-trips to the row's post-write state, no raw `UPDATE obligations` exists outside the use-case layer, no `DELETE FROM curator_edits` exists anywhere.
2. **`curator_auth.yml`** — reader-role keys cannot call curator routes, curator-role keys can, MCP `tools/list` filters by role, CLI never logs the API key value.
3. **`curator_integrity.yml`** — AUTHORITATIVE rows cannot be updated by any code path, tier transitions follow the nine-cell matrix, `If-Match` mismatch returns 409, `curator_edits.reason` non-empty enforced at both DB and API layers, `derivedFrom` immutable on CURATED rows.
4. **`provenance_tiers.yml`** — new rule `PROV-008` forbids raw `UPDATE` on any provenance-bearing table outside the use-case layer.

Full YAML in `docs/contracts/`.

## Exit-Criterion Test

`tests/integration/curator-workflow.test.ts`, runs against a fresh DB:

```
1. pnpm --filter @lexius/db db:migrate + db:seed
2. create a curator API key via pnpm create-api-key --role curator --owner test@example.com
3. lexius-curate login --key ... (writes to a temp credentials dir)
4. lexius-curate obligations create ... --apply              → returns id + row_version 1
5. lexius-curate obligations edit <id> ... --apply           → row_version 2
6. lexius-curate obligations edit <id> ... --apply           → row_version 3
7. lexius-curate obligations history <id>                     → three audit rows visible
8. lexius-curate revert <edit_id_from_step_6> --apply        → row_version 4
9. lexius-curate obligations history <id>                     → four audit rows, last action='revert'
10. pnpm crosscheck                                            → exits 0 (numeric fields still consistent)
```

CI job runs this against a throwaway Postgres. Green is the only acceptable result for shipping v1.

## Rollout

1. Migration PR lands on its own. Zero behaviour change.
2. Domain + use cases PR. Behind feature flag (`LEXIUS_CURATOR_WORKFLOW=enabled`) in case of rollback.
3. API routes PR. Still behind flag.
4. Credentials package + CLI package PR. Published to npm as `0.1.0`.
5. MCP dynamic tool listing PR. No new tools yet, just the filter.
6. Fetcher staleness hook PR.
7. Seed idempotency PR.
8. Exit-criterion test PR. Feature flag removed in the same PR once green.
9. Docs PR: README section on curator workflow + env-var table update.

Each step is deployable and the flag can be flipped off if anything surfaces. Full feature goes live when step 8 merges.
