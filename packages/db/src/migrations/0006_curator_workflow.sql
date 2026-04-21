-- Curator Workflow Wave 1 (PRD-013 / ARD-017 / DDD-016)
-- Live CURATED-tier editing: role-gated api keys, concurrency on obligations,
-- staleness flagging, soft-delete, and the append-only curator_edits audit log.

-- 1. api_keys gains a role column ----------------------------------------
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'reader'
    CHECK ("role" IN ('reader', 'curator'));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "api_keys_role_idx" ON "api_keys" ("role");
--> statement-breakpoint

-- 2. obligations gains concurrency + staleness + soft-delete columns -----
ALTER TABLE "obligations"
  ADD COLUMN IF NOT EXISTS "row_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "needs_review" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stale_since" timestamp,
  ADD COLUMN IF NOT EXISTS "deprecated_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deprecated_reason" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "obligations_needs_review_idx"
  ON "obligations" ("needs_review", "stale_since")
  WHERE "needs_review" = true;
--> statement-breakpoint

-- 3. curator_edits — append-only audit log -------------------------------
CREATE TABLE IF NOT EXISTS "curator_edits" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"entity_type" text NOT NULL CHECK ("entity_type" IN ('obligation')),
	"entity_id" varchar NOT NULL,
	"editor_id" text NOT NULL,
	"editor_ip" inet,
	"editor_ua" text,
	"source" text NOT NULL CHECK ("source" IN ('cli', 'agent', 'mcp', 'skill', 'wiki', 'api')),
	"action" text NOT NULL CHECK ("action" IN ('create', 'update', 'revert', 'deprecate')),
	"old_values" jsonb,
	"new_values" jsonb NOT NULL,
	"row_version_before" integer,
	"row_version_after" integer NOT NULL,
	"reason" text NOT NULL CHECK (length("reason") > 0),
	"cross_check_result" jsonb,
	"edited_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "curator_edits_entity_idx"
  ON "curator_edits" ("entity_type", "entity_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "curator_edits_editor_idx"
  ON "curator_edits" ("editor_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "curator_edits_edited_at_idx"
  ON "curator_edits" ("edited_at" DESC);
--> statement-breakpoint

-- 4. curator_edits is append-only at the privilege level ------------------
REVOKE DELETE ON "curator_edits" FROM PUBLIC;

-- -----------------------------------------------------------------------
-- DOWN (rollback) -- not executed; documented for operator use.
-- -----------------------------------------------------------------------
-- DROP INDEX IF EXISTS "curator_edits_edited_at_idx";
-- DROP INDEX IF EXISTS "curator_edits_editor_idx";
-- DROP INDEX IF EXISTS "curator_edits_entity_idx";
-- DROP TABLE IF EXISTS "curator_edits";
-- DROP INDEX IF EXISTS "obligations_needs_review_idx";
-- ALTER TABLE "obligations"
--   DROP COLUMN IF EXISTS "deprecated_reason",
--   DROP COLUMN IF EXISTS "deprecated_at",
--   DROP COLUMN IF EXISTS "stale_since",
--   DROP COLUMN IF EXISTS "needs_review",
--   DROP COLUMN IF EXISTS "row_version";
-- DROP INDEX IF EXISTS "api_keys_role_idx";
-- ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "role";
