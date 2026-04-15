import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { legislations } from "./legislations.js";

const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 3072})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    if (!value) return [];
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
    embedding: vector("embedding", { dimensions: 3072 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("articles_legislation_id_idx").on(table.legislationId),
    uniqueIndex("articles_legislation_id_number_idx").on(
      table.legislationId,
      table.number,
    ),
    index("articles_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  ],
);
