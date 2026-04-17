import {
  pgTable, serial, uuid, varchar, text, timestamp, integer, jsonb, index,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";
import { articleExtracts } from "./article-extracts.js";
import { findingType, provenanceTier } from "./enums.js";

export const complianceWorkspace = pgTable(
  "compliance_workspace",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    agentId: text("agent_id").notNull(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    findingType: findingType("finding_type").notNull(),
    finding: jsonb("finding").notNull(),
    provenanceTier: provenanceTier("provenance_tier").notNull(),
    sourceExtractId: integer("source_extract_id")
      .references(() => articleExtracts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionArticleIdx: index("cw_session_article_idx").on(
      table.sessionId, table.articleId,
    ),
    sessionTypeIdx: index("cw_session_type_idx").on(
      table.sessionId, table.findingType,
    ),
    sessionIdx: index("cw_session_idx").on(table.sessionId),
  }),
);
