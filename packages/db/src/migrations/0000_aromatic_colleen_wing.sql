CREATE TABLE IF NOT EXISTS "articles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"number" varchar NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"full_text" text,
	"source_url" text,
	"related_annexes" text[],
	"embedding" vector(1536),
	"source_format" varchar(16),
	"source_hash" varchar(64),
	"fetched_at" timestamp,
	"verbatim" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadlines" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"event" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faq" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"article_references" text[],
	"keywords" text[],
	"category" text,
	"source_url" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legislations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"effective_date" timestamp NOT NULL,
	"source_url" text,
	"version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obligations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"risk_level" text NOT NULL,
	"obligation" text NOT NULL,
	"article" text,
	"deadline" timestamp,
	"details" text,
	"category" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "penalties" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"violation_type" text NOT NULL,
	"name" text NOT NULL,
	"max_fine_eur" numeric(15, 2),
	"global_turnover_percentage" numeric(5, 2),
	"article" text,
	"description" text,
	"applicable_to" text[],
	"sme_rules" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risk_categories" (
	"id" varchar PRIMARY KEY NOT NULL,
	"legislation_id" varchar NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"description" text,
	"keywords" text[],
	"examples" text[],
	"relevant_articles" text[],
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "articles" ADD CONSTRAINT "articles_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "faq" ADD CONSTRAINT "faq_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "obligations" ADD CONSTRAINT "obligations_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "penalties" ADD CONSTRAINT "penalties_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_categories" ADD CONSTRAINT "risk_categories_legislation_id_legislations_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_legislation_id_idx" ON "articles" USING btree ("legislation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_legislation_id_number_idx" ON "articles" USING btree ("legislation_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_embedding_idx" ON "articles" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadlines_legislation_id_idx" ON "deadlines" USING btree ("legislation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faq_legislation_id_idx" ON "faq" USING btree ("legislation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faq_embedding_idx" ON "faq" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_legislation_id_idx" ON "obligations" USING btree ("legislation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_legislation_role_risk_idx" ON "obligations" USING btree ("legislation_id","role","risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_embedding_idx" ON "obligations" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "penalties_legislation_id_idx" ON "penalties" USING btree ("legislation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "penalties_legislation_violation_idx" ON "penalties" USING btree ("legislation_id","violation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_categories_legislation_id_idx" ON "risk_categories" USING btree ("legislation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "risk_categories_legislation_id_name_idx" ON "risk_categories" USING btree ("legislation_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_categories_embedding_idx" ON "risk_categories" USING hnsw ("embedding" vector_cosine_ops);