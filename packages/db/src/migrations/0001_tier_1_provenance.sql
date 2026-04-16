-- Tier 1 Provenance (PRD-007 / ARD-011 / DDD-010)
-- Adds honest labelling, derivation chains, and article revision history.
--
-- Order:
--   1. Create provenance_tier enum
--   2. Create article_revisions table + index
--   3. Add provenance columns (nullable) to the six provenance-bearing tables
--   4. Add derived_from arrays to obligations and faq
--   5. Backfill provenance_tier and derived_from from existing signals
--   6. Make provenance_tier NOT NULL
--   7. Add table-level CHECK constraints enforcing tier-specific required fields
--   8. Install revision-archiving and derived_from validation triggers

-- 1. Enum -----------------------------------------------------------------
DO $$ BEGIN
 CREATE TYPE "provenance_tier" AS ENUM ('AUTHORITATIVE', 'CURATED', 'AI_GENERATED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 2. article_revisions table ---------------------------------------------
CREATE TABLE IF NOT EXISTS "article_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" varchar NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"source_url" text,
	"source_format" varchar(16),
	"title" text NOT NULL,
	"full_text" text NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"superseded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_revisions_article_id_idx" ON "article_revisions" USING btree ("article_id","superseded_at" DESC);
--> statement-breakpoint

-- 3. Add provenance columns (nullable for now) ---------------------------
-- articles already has source_url, source_hash, fetched_at from PRD-006.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint

-- obligations: full column set + derived_from
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "source_url" text;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "derived_from" text[] NOT NULL DEFAULT '{}'::text[];--> statement-breakpoint

-- faq: already has source_url; add remaining + derived_from
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN IF NOT EXISTS "derived_from" text[] NOT NULL DEFAULT '{}'::text[];--> statement-breakpoint

-- penalties
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "source_url" text;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint

-- deadlines
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "source_url" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint

-- risk_categories
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "provenance_tier" "provenance_tier";--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "source_url" text;--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "curated_by" text;--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "risk_categories" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;--> statement-breakpoint

-- 4. Backfill ------------------------------------------------------------

-- Articles: verbatim TRUE -> AUTHORITATIVE; verbatim FALSE -> CURATED.
-- AUTHORITATIVE rows already have source_hash / source_url / fetched_at from PRD-006.
UPDATE "articles"
SET provenance_tier = 'AUTHORITATIVE'
WHERE verbatim = true
  AND source_hash IS NOT NULL
  AND source_url IS NOT NULL
  AND fetched_at IS NOT NULL;
--> statement-breakpoint

UPDATE "articles"
SET provenance_tier = 'CURATED',
    curated_by = COALESCE(curated_by, 'legacy-seed'),
    reviewed_at = COALESCE(reviewed_at, created_at)
WHERE provenance_tier IS NULL;
--> statement-breakpoint

-- Obligations: best-effort parse of the human-readable "article" field into a
-- db article id of the form <legislation_id>-art-<number>. Rows without a
-- parseable article leave derived_from = '{}'.
UPDATE "obligations" SET
  provenance_tier = 'CURATED',
  curated_by      = COALESCE(curated_by, 'legacy-seed'),
  reviewed_at     = COALESCE(reviewed_at, created_at),
  derived_from    = CASE
    WHEN article IS NULL OR article = '' THEN '{}'::text[]
    WHEN article ~* '^\s*Art\.?\s*\d+' THEN ARRAY[
      legislation_id || '-art-' ||
      lower(regexp_replace(article, '^\s*Art\.?\s*(\d+).*$', '\1'))
    ]
    ELSE '{}'::text[]
  END
WHERE provenance_tier IS NULL;
--> statement-breakpoint

-- Keep only derived_from entries that resolve to an existing article, so the
-- validate_derived_from trigger (added below) does not reject legacy rows.
UPDATE "obligations" o
SET derived_from = (
  SELECT COALESCE(array_agg(a), '{}'::text[])
  FROM unnest(o.derived_from) a
  WHERE EXISTS (SELECT 1 FROM "articles" art WHERE art.id = a)
)
WHERE array_length(o.derived_from, 1) IS NOT NULL;
--> statement-breakpoint

-- FAQ: CURATED, copy article_references into derived_from with same transform.
UPDATE "faq" SET
  provenance_tier = 'CURATED',
  curated_by      = COALESCE(curated_by, 'legacy-seed'),
  reviewed_at     = COALESCE(reviewed_at, created_at),
  derived_from    = CASE
    WHEN article_references IS NULL OR array_length(article_references, 1) IS NULL THEN '{}'::text[]
    ELSE (
      SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[])
      FROM (
        SELECT CASE
          WHEN ref ~* '^\s*Art\.?\s*\d+' THEN
            legislation_id || '-art-' || lower(regexp_replace(ref, '^\s*Art\.?\s*(\d+).*$', '\1'))
          ELSE NULL
        END AS x
        FROM unnest(article_references) AS ref
      ) parsed
      WHERE x IS NOT NULL
    )
  END
WHERE provenance_tier IS NULL;
--> statement-breakpoint

-- Drop any faq derived_from entries that don't resolve to a real article.
UPDATE "faq" f
SET derived_from = (
  SELECT COALESCE(array_agg(a), '{}'::text[])
  FROM unnest(f.derived_from) a
  WHERE EXISTS (SELECT 1 FROM "articles" art WHERE art.id = a)
)
WHERE array_length(f.derived_from, 1) IS NOT NULL;
--> statement-breakpoint

-- Penalties / deadlines / risk_categories: CURATED, legacy-seed
UPDATE "penalties" SET
  provenance_tier = 'CURATED',
  curated_by      = COALESCE(curated_by, 'legacy-seed'),
  reviewed_at     = COALESCE(reviewed_at, created_at)
WHERE provenance_tier IS NULL;
--> statement-breakpoint

UPDATE "deadlines" SET
  provenance_tier = 'CURATED',
  curated_by      = COALESCE(curated_by, 'legacy-seed'),
  reviewed_at     = COALESCE(reviewed_at, created_at)
WHERE provenance_tier IS NULL;
--> statement-breakpoint

UPDATE "risk_categories" SET
  provenance_tier = 'CURATED',
  curated_by      = COALESCE(curated_by, 'legacy-seed'),
  reviewed_at     = COALESCE(reviewed_at, created_at)
WHERE provenance_tier IS NULL;
--> statement-breakpoint

-- 5. Lock provenance_tier NOT NULL ---------------------------------------
ALTER TABLE "articles"        ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "obligations"     ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "faq"             ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "penalties"       ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deadlines"       ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_categories" ALTER COLUMN "provenance_tier" SET NOT NULL;--> statement-breakpoint

-- 6. Tier-required CHECK constraints -------------------------------------
ALTER TABLE "articles" ADD CONSTRAINT "articles_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "obligations" ADD CONSTRAINT "obligations_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "faq" ADD CONSTRAINT "faq_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "penalties" ADD CONSTRAINT "penalties_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "risk_categories" ADD CONSTRAINT "risk_categories_provenance_required" CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
--> statement-breakpoint

-- 7. Triggers ------------------------------------------------------------

-- Archive prior article row into article_revisions on source_hash change.
-- Fires for UPDATE including those produced by INSERT ... ON CONFLICT DO UPDATE.
CREATE OR REPLACE FUNCTION archive_article_revision() RETURNS trigger AS $$
BEGIN
  IF OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO article_revisions
      (article_id, source_hash, source_url, source_format, title, full_text, fetched_at)
    VALUES
      (OLD.id, OLD.source_hash, OLD.source_url, OLD.source_format, OLD.title, OLD.full_text, OLD.fetched_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS articles_archive_on_update ON articles;
--> statement-breakpoint

CREATE TRIGGER articles_archive_on_update
  BEFORE UPDATE ON articles
  FOR EACH ROW
  WHEN (OLD.source_hash IS NOT NULL)
  EXECUTE FUNCTION archive_article_revision();
--> statement-breakpoint

-- Validate derived_from references resolve to existing articles.
CREATE OR REPLACE FUNCTION validate_derived_from() RETURNS trigger AS $$
DECLARE missing text;
BEGIN
  IF NEW.derived_from IS NOT NULL AND array_length(NEW.derived_from, 1) > 0 THEN
    SELECT a INTO missing
    FROM unnest(NEW.derived_from) a
    WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = a);
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'derived_from references unknown article: %', missing;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS obligations_validate_derived_from ON obligations;
--> statement-breakpoint

CREATE TRIGGER obligations_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON obligations
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();
--> statement-breakpoint

DROP TRIGGER IF EXISTS faq_validate_derived_from ON faq;
--> statement-breakpoint

CREATE TRIGGER faq_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON faq
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();

-- -----------------------------------------------------------------------
-- DOWN (rollback) -- not executed; documented for operator use.
-- -----------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS faq_validate_derived_from ON faq;
-- DROP TRIGGER IF EXISTS obligations_validate_derived_from ON obligations;
-- DROP TRIGGER IF EXISTS articles_archive_on_update ON articles;
-- DROP FUNCTION IF EXISTS validate_derived_from();
-- DROP FUNCTION IF EXISTS archive_article_revision();
--
-- ALTER TABLE "risk_categories" DROP CONSTRAINT IF EXISTS "risk_categories_provenance_required";
-- ALTER TABLE "deadlines"       DROP CONSTRAINT IF EXISTS "deadlines_provenance_required";
-- ALTER TABLE "penalties"       DROP CONSTRAINT IF EXISTS "penalties_provenance_required";
-- ALTER TABLE "faq"             DROP CONSTRAINT IF EXISTS "faq_provenance_required";
-- ALTER TABLE "obligations"     DROP CONSTRAINT IF EXISTS "obligations_provenance_required";
-- ALTER TABLE "articles"        DROP CONSTRAINT IF EXISTS "articles_provenance_required";
--
-- DROP INDEX IF EXISTS "article_revisions_article_id_idx";
-- DROP TABLE IF EXISTS "article_revisions";
--
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "fetched_at";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "source_hash";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "source_url";
-- ALTER TABLE "risk_categories" DROP COLUMN IF EXISTS "provenance_tier";
--
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "fetched_at";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "source_hash";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "source_url";
-- ALTER TABLE "deadlines" DROP COLUMN IF EXISTS "provenance_tier";
--
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "fetched_at";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "source_hash";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "source_url";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "provenance_tier";
--
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "derived_from";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "fetched_at";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "source_hash";
-- ALTER TABLE "faq" DROP COLUMN IF EXISTS "provenance_tier";
--
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "derived_from";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "fetched_at";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "source_hash";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "source_url";
-- ALTER TABLE "obligations" DROP COLUMN IF EXISTS "provenance_tier";
--
-- ALTER TABLE "articles" DROP COLUMN IF EXISTS "generated_at";
-- ALTER TABLE "articles" DROP COLUMN IF EXISTS "generated_by_model";
-- ALTER TABLE "articles" DROP COLUMN IF EXISTS "reviewed_at";
-- ALTER TABLE "articles" DROP COLUMN IF EXISTS "curated_by";
-- ALTER TABLE "articles" DROP COLUMN IF EXISTS "provenance_tier";
--
-- DROP TYPE IF EXISTS "provenance_tier";
