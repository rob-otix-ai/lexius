import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
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
    embedding: vector("embedding", { dimensions: 1536 }),
    derivedFrom: text("derived_from").array().notNull().default([]),
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
    legislationIdIdx: index("obligations_legislation_id_idx").on(table.legislationId),
    legislationRoleRiskIdx: index("obligations_legislation_role_risk_idx").on(
      table.legislationId,
      table.role,
      table.riskLevel,
    ),
    embeddingIdx: index("obligations_embedding_idx")
      .using("hnsw", table.embedding.asc().nullsLast())
      .with({ opclass: "vector_cosine_ops" }),
  }),
);
