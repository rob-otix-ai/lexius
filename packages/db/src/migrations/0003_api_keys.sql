-- Claude Integration Wave 0 (PRD-009 / ARD-013 / DDD-012)
-- Adds the api_keys table for per-user/org API key authentication.
-- Keys are stored as SHA-256 hashes; only the prefix is in cleartext.

CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" varchar(64) NOT NULL UNIQUE,
	"key_prefix" varchar(12) NOT NULL,
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"scopes" text[] NOT NULL DEFAULT '{}',
	"rate_limit" integer NOT NULL DEFAULT 100,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"last_used_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "api_keys_owner_email_idx" ON "api_keys" ("owner_email");
