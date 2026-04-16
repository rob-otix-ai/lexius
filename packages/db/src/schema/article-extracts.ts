import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";
import { provenanceTier, extractType } from "./enums.js";

export const articleExtracts = pgTable(
  "article_extracts",
  {
    id: serial("id").primaryKey(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    extractType: extractType("extract_type").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 20, scale: 2 }),
    valueText: text("value_text"),
    valueDate: timestamp("value_date"),
    paragraphRef: text("paragraph_ref").notNull().default(""),
    verbatimExcerpt: text("verbatim_excerpt").notNull(),
    valueHash: varchar("value_hash", { length: 64 }).notNull(),
    provenanceTier: provenanceTier("provenance_tier")
      .notNull()
      .default("AUTHORITATIVE"),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  },
  (table) => ({
    articleTypeIdx: index("article_extracts_article_type_idx").on(
      table.articleId,
      table.extractType,
    ),
    sourceHashIdx: index("article_extracts_source_hash_idx").on(
      table.sourceHash,
    ),
    naturalKey: uniqueIndex("article_extracts_natural_key").on(
      table.articleId,
      table.extractType,
      table.paragraphRef,
      table.valueHash,
    ),
  }),
);
