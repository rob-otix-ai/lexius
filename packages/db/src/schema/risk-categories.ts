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
      .references(() => legislations.id)
      .notNull(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    description: text("description"),
    keywords: text("keywords").array(),
    examples: text("examples").array(),
    relevantArticles: text("relevant_articles").array(),
    embedding: vector("embedding", { dimensions: 3072 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("risk_categories_legislation_id_idx").on(table.legislationId),
    uniqueIndex("risk_categories_legislation_id_name_idx").on(
      table.legislationId,
      table.name,
    ),
    index("risk_categories_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  ],
);
