import { pgTable, serial, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { articles } from "./articles.js";

export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: serial("id").primaryKey(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    sourceUrl: text("source_url"),
    sourceFormat: varchar("source_format", { length: 16 }),
    title: text("title").notNull(),
    fullText: text("full_text").notNull(),
    fetchedAt: timestamp("fetched_at").notNull(),
    supersededAt: timestamp("superseded_at").defaultNow().notNull(),
  },
  (table) => ({
    articleIdIdx: index("article_revisions_article_id_idx").on(
      table.articleId,
      table.supersededAt.desc(),
    ),
  }),
);
