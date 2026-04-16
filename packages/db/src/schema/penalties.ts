import {
  pgTable,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { legislations } from "./legislations.js";
import { provenanceTier } from "./enums.js";

export const penalties = pgTable(
  "penalties",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id, { onDelete: "cascade" })
      .notNull(),
    violationType: text("violation_type").notNull(),
    name: text("name").notNull(),
    maxFineEur: numeric("max_fine_eur", { precision: 15, scale: 2 }),
    globalTurnoverPercentage: numeric("global_turnover_percentage", { precision: 5, scale: 2 }),
    article: text("article"),
    description: text("description"),
    applicableTo: text("applicable_to").array(),
    smeRules: jsonb("sme_rules"),
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
    legislationIdIdx: index("penalties_legislation_id_idx").on(table.legislationId),
    legislationViolationIdx: uniqueIndex("penalties_legislation_violation_idx").on(
      table.legislationId,
      table.violationType,
    ),
  }),
);
