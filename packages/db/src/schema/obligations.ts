import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
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

export const obligations = pgTable(
  "obligations",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(),
    riskLevel: text("risk_level").notNull(),
    obligation: text("obligation").notNull(),
    article: text("article"),
    deadline: timestamp("deadline"),
    details: text("details"),
    category: text("category"),
    embedding: vector("embedding", { dimensions: 3072 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("obligations_legislation_id_idx").on(table.legislationId),
    index("obligations_legislation_role_risk_idx").on(
      table.legislationId,
      table.role,
      table.riskLevel,
    ),
    index("obligations_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  ],
);
