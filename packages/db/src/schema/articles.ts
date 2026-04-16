import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  boolean,
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

export const articles = pgTable(
  "articles",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id, { onDelete: "cascade" })
      .notNull(),
    number: varchar("number").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    fullText: text("full_text"),
    sourceUrl: text("source_url"),
    relatedAnnexes: text("related_annexes").array(),
    embedding: vector("embedding", { dimensions: 1536 }),
    sourceFormat: varchar("source_format", { length: 16 }),
    sourceHash: varchar("source_hash", { length: 64 }),
    fetchedAt: timestamp("fetched_at"),
    verbatim: boolean("verbatim").default(false).notNull(),
    provenanceTier: provenanceTier("provenance_tier").notNull(),
    curatedBy: text("curated_by"),
    reviewedAt: timestamp("reviewed_at"),
    generatedByModel: text("generated_by_model"),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    legislationIdIdx: index("articles_legislation_id_idx").on(table.legislationId),
    legislationIdNumberIdx: uniqueIndex("articles_legislation_id_number_idx").on(
      table.legislationId,
      table.number,
    ),
    embeddingIdx: index("articles_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  }),
);
