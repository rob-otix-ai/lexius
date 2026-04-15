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

export const penalties = pgTable(
  "penalties",
  {
    id: varchar("id").primaryKey(),
    legislationId: varchar("legislation_id")
      .references(() => legislations.id)
      .notNull(),
    violationType: text("violation_type").notNull(),
    name: text("name").notNull(),
    maxFineEur: numeric("max_fine_eur"),
    globalTurnoverPercentage: numeric("global_turnover_percentage"),
    article: text("article"),
    description: text("description"),
    applicableTo: text("applicable_to").array(),
    smeRules: jsonb("sme_rules"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("penalties_legislation_id_idx").on(table.legislationId),
    uniqueIndex("penalties_legislation_violation_idx").on(
      table.legislationId,
      table.violationType,
    ),
  ],
);
