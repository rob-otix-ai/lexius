-- Hivemind Swarm Wave 0 (PRD-010 / ARD-014 / DDD-013)
-- Adds finding_type enum, compliance_workspace table, and swarm_work_queue table.

-- 1. Finding type enum ----------------------------------------------------
DO $$ BEGIN
 CREATE TYPE "finding_type" AS ENUM (
   'obligation', 'penalty', 'deadline', 'cross_ref', 'gap', 'risk'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 2. Compliance workspace -------------------------------------------------
CREATE TABLE IF NOT EXISTS "compliance_workspace" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"article_id" varchar NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
	"finding_type" "finding_type" NOT NULL,
	"finding" jsonb NOT NULL,
	"provenance_tier" "provenance_tier" NOT NULL,
	"source_extract_id" integer REFERENCES "article_extracts"("id") ON DELETE SET NULL,
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cw_session_article_idx" ON "compliance_workspace" ("session_id", "article_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cw_session_type_idx" ON "compliance_workspace" ("session_id", "finding_type");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cw_session_idx" ON "compliance_workspace" ("session_id");
--> statement-breakpoint

-- 3. Work queue -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "swarm_work_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"article_id" varchar NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
	"claimed_by" text,
	"claimed_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "swq_session_unclaimed_idx" ON "swarm_work_queue" ("session_id", "claimed_by");

-- -----------------------------------------------------------------------
-- DOWN (rollback) -- not executed; documented for operator use.
-- -----------------------------------------------------------------------
-- DROP INDEX IF EXISTS "swq_session_unclaimed_idx";
-- DROP TABLE IF EXISTS "swarm_work_queue";
--
-- DROP INDEX IF EXISTS "cw_session_idx";
-- DROP INDEX IF EXISTS "cw_session_type_idx";
-- DROP INDEX IF EXISTS "cw_session_article_idx";
-- DROP TABLE IF EXISTS "compliance_workspace";
--
-- DROP TYPE IF EXISTS "finding_type";
