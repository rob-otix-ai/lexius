-- Deterministic Extractor (PRD-008 / ARD-012 / DDD-011)
-- Adds the article_extracts table + its append-only revision log, and extends
-- penalties with derivation + extract-exemption fields so the CI cross-check
-- can anchor curated penalty claims to verbatim extracted facts.
--
-- Order:
--   1. Create extract_type enum
--   2. Create article_extracts table + indexes + CHECK constraints
--   3. Create article_extract_revisions table + index
--   4. Install archive_article_extract_revision() + trigger
--   5. Add derived_from / extract_exempt / extract_exempt_reason to penalties
--   6. Backfill penalties.derived_from from the existing article column
--   7. Add penalties_extract_exempt_has_reason CHECK
--   8. Install penalties_validate_derived_from trigger (function reused from 0001)

-- 1. Enum -----------------------------------------------------------------
DO $$ BEGIN
 CREATE TYPE "extract_type" AS ENUM (
   'fine_amount_eur',
   'turnover_percentage',
   'date',
   'article_cross_ref',
   'annex_cross_ref',
   'shall_clause',
   'annex_item'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 2. article_extracts table ----------------------------------------------
CREATE TABLE IF NOT EXISTS "article_extracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" varchar NOT NULL,
	"extract_type" "extract_type" NOT NULL,
	"value_numeric" numeric(20, 2),
	"value_text" text,
	"value_date" timestamp,
	"paragraph_ref" text DEFAULT '' NOT NULL,
	"verbatim_excerpt" text NOT NULL,
	"value_hash" varchar(64) NOT NULL,
	"provenance_tier" "provenance_tier" DEFAULT 'AUTHORITATIVE' NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "article_extracts" ADD CONSTRAINT "article_extracts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "article_extracts" ADD CONSTRAINT "article_extracts_provenance_authoritative"
  CHECK (provenance_tier = 'AUTHORITATIVE');
--> statement-breakpoint

ALTER TABLE "article_extracts" ADD CONSTRAINT "article_extracts_value_present"
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL OR value_date IS NOT NULL);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "article_extracts_natural_key" ON "article_extracts" USING btree ("article_id","extract_type","paragraph_ref","value_hash");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_extracts_article_type_idx" ON "article_extracts" USING btree ("article_id","extract_type");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_extracts_source_hash_idx" ON "article_extracts" USING btree ("source_hash");
--> statement-breakpoint

-- 3. article_extract_revisions table -------------------------------------
CREATE TABLE IF NOT EXISTS "article_extract_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"extract_id" integer NOT NULL,
	"article_id" varchar NOT NULL,
	"extract_type" "extract_type" NOT NULL,
	"value_numeric" numeric(20, 2),
	"value_text" text,
	"value_date" timestamp,
	"paragraph_ref" text NOT NULL,
	"verbatim_excerpt" text NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"extracted_at" timestamp NOT NULL,
	"superseded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_extract_revisions_extract_id_idx" ON "article_extract_revisions" USING btree ("extract_id","superseded_at" DESC);
--> statement-breakpoint

-- 4. Archive trigger -----------------------------------------------------
-- Archive the OLD row into article_extract_revisions on DELETE, and on UPDATE
-- when source_hash changes (indicating a re-extraction against new article
-- text). Pure-metadata UPDATEs that do not touch source_hash are not archived.
CREATE OR REPLACE FUNCTION archive_article_extract_revision() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO article_extract_revisions
      (extract_id, article_id, extract_type, value_numeric, value_text, value_date,
       paragraph_ref, verbatim_excerpt, source_hash, extracted_at)
    VALUES
      (OLD.id, OLD.article_id, OLD.extract_type, OLD.value_numeric, OLD.value_text, OLD.value_date,
       OLD.paragraph_ref, OLD.verbatim_excerpt, OLD.source_hash, OLD.extracted_at);
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS article_extracts_archive_on_change ON article_extracts;
--> statement-breakpoint

CREATE TRIGGER article_extracts_archive_on_change
  BEFORE UPDATE OR DELETE ON article_extracts
  FOR EACH ROW EXECUTE FUNCTION archive_article_extract_revision();
--> statement-breakpoint

-- 5. Penalties: add derivation + exemption columns -----------------------
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "derived_from" text[] NOT NULL DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "extract_exempt" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN IF NOT EXISTS "extract_exempt_reason" text;--> statement-breakpoint

-- 6. Backfill penalties.derived_from from the existing "article" text column.
-- Uses the same regexp_replace transform as the 0001 obligations backfill:
-- "Art. 99(3)" -> ARRAY['eu-ai-act-art-99']. Unparseable rows stay '{}'.
UPDATE "penalties" SET
  derived_from = CASE
    WHEN article IS NULL OR article = '' THEN '{}'::text[]
    WHEN article ~* '^\s*Art\.?\s*\d+' THEN ARRAY[
      legislation_id || '-art-' ||
      lower(regexp_replace(article, '^\s*Art\.?\s*(\d+).*$', '\1'))
    ]
    ELSE '{}'::text[]
  END
WHERE derived_from = '{}'::text[];
--> statement-breakpoint

-- Drop backfilled derived_from entries that don't resolve to an existing
-- article, so the validate_derived_from trigger does not reject legacy rows.
UPDATE "penalties" p
SET derived_from = (
  SELECT COALESCE(array_agg(a), '{}'::text[])
  FROM unnest(p.derived_from) a
  WHERE EXISTS (SELECT 1 FROM "articles" art WHERE art.id = a)
)
WHERE array_length(p.derived_from, 1) IS NOT NULL;
--> statement-breakpoint

-- 7. extract_exempt CHECK ------------------------------------------------
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_extract_exempt_has_reason"
  CHECK (NOT extract_exempt OR extract_exempt_reason IS NOT NULL);
--> statement-breakpoint

-- 8. derived_from validation trigger on penalties ------------------------
-- Reuses validate_derived_from() installed in migration 0001.
DROP TRIGGER IF EXISTS penalties_validate_derived_from ON penalties;
--> statement-breakpoint

CREATE TRIGGER penalties_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON penalties
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();

-- -----------------------------------------------------------------------
-- DOWN (rollback) -- not executed; documented for operator use.
-- -----------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS penalties_validate_derived_from ON penalties;
-- ALTER TABLE "penalties" DROP CONSTRAINT IF EXISTS "penalties_extract_exempt_has_reason";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "extract_exempt_reason";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "extract_exempt";
-- ALTER TABLE "penalties" DROP COLUMN IF EXISTS "derived_from";
--
-- DROP TRIGGER IF EXISTS article_extracts_archive_on_change ON article_extracts;
-- DROP FUNCTION IF EXISTS archive_article_extract_revision();
--
-- DROP INDEX IF EXISTS "article_extract_revisions_extract_id_idx";
-- DROP TABLE IF EXISTS "article_extract_revisions";
--
-- DROP INDEX IF EXISTS "article_extracts_source_hash_idx";
-- DROP INDEX IF EXISTS "article_extracts_article_type_idx";
-- DROP INDEX IF EXISTS "article_extracts_natural_key";
-- ALTER TABLE "article_extracts" DROP CONSTRAINT IF EXISTS "article_extracts_value_present";
-- ALTER TABLE "article_extracts" DROP CONSTRAINT IF EXISTS "article_extracts_provenance_authoritative";
-- DROP TABLE IF EXISTS "article_extracts";
--
-- DROP TYPE IF EXISTS "extract_type";
