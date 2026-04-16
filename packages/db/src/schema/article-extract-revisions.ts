import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { extractType } from "./enums.js";

export const articleExtractRevisions = pgTable(
  "article_extract_revisions",
  {
    id: serial("id").primaryKey(),
    extractId: integer("extract_id").notNull(),
    articleId: varchar("article_id").notNull(),
    extractType: extractType("extract_type").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 20, scale: 2 }),
    valueText: text("value_text"),
    valueDate: timestamp("value_date"),
    paragraphRef: text("paragraph_ref").notNull(),
    verbatimExcerpt: text("verbatim_excerpt").notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    extractedAt: timestamp("extracted_at").notNull(),
    supersededAt: timestamp("superseded_at").defaultNow().notNull(),
  },
  (table) => ({
    extractIdIdx: index("article_extract_revisions_extract_id_idx").on(
      table.extractId,
      table.supersededAt.desc(),
    ),
  }),
);
