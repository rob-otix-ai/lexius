import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const legislations = pgTable("legislations", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  sourceUrl: text("source_url"),
  version: text("version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
