import {
  pgTable, serial, uuid, varchar, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";

export const swarmWorkQueue = pgTable(
  "swarm_work_queue",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    claimedBy: text("claimed_by"),
    claimedAt: timestamp("claimed_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    sessionUnclaimedIdx: index("swq_session_unclaimed_idx").on(
      table.sessionId, table.claimedBy,
    ),
  }),
);
