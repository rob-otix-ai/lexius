import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { legislations } from "./legislations.js";
import { provenanceTier } from "./enums.js";

const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (!value || typeof value !== "string") return [];
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});

export const riskCategories = pgTable(
  "risk_categories",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    description: text("description"),
    keywords: text("keywords").array(),
    examples: text("examples").array(),
    relevantArticles: text("relevant_articles").array(),
    embedding: vector("embedding", { dimensions: 1536 }),
    provenanceTier: provenanceTier("provenance_tier").notNull(),
    sourceUrl: text("source_url"),
    sourceHash: varchar("source_hash", { length: 64 }),
    fetchedAt: timestamp("fetched_at"),
    curatedBy: text("curated_by"),
    reviewedAt: timestamp("reviewed_at"),
    generatedByModel: text("generated_by_model"),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    legislationIdIdx: index("risk_categories_legislation_id_idx").on(table.legislationId),
    legislationIdNameIdx: uniqueIndex("risk_categories_legislation_id_name_idx").on(
      table.legislationId,
      table.name,
    ),
    embeddingIdx: index("risk_categories_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  }),
);
