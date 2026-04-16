import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { legislations } from "./legislations.js";
import { provenanceTier } from "./enums.js";

export const deadlines = pgTable(
  "deadlines",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id, { onDelete: "cascade" })
      .notNull(),
    date: timestamp("date").notNull(),
    event: text("event").notNull(),
    description: text("description"),
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
    legislationIdIdx: index("deadlines_legislation_id_idx").on(table.legislationId),
  }),
);
