import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

// `inet` isn't a first-class Drizzle column type, so define it via customType.
const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return "inet";
  },
});

export const curatorEdits = pgTable(
  "curator_edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: varchar("entity_id").notNull(),
    editorId: text("editor_id").notNull(),
    editorIp: inet("editor_ip"),
    editorUa: text("editor_ua"),
    source: text("source").notNull(),
    action: text("action").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values").notNull(),
    rowVersionBefore: integer("row_version_before"),
    rowVersionAfter: integer("row_version_after").notNull(),
    reason: text("reason").notNull(),
    crossCheckResult: jsonb("cross_check_result"),
    editedAt: timestamp("edited_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("curator_edits_entity_idx").on(table.entityType, table.entityId),
    editorIdx: index("curator_edits_editor_idx").on(table.editorId),
    editedAtIdx: index("curator_edits_edited_at_idx").on(table.editedAt.desc()),
  }),
);

export type CuratorEditSource = "cli" | "agent" | "mcp" | "skill" | "wiki" | "api";
export type CuratorEditAction = "create" | "update" | "revert" | "deprecate";
export type CuratorEditEntityType = "obligation";
