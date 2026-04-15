import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { legislations } from "./legislations.js";

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("deadlines_legislation_id_idx").on(table.legislationId),
  ],
);
