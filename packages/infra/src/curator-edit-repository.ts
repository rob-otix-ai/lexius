import { and, desc, eq, gte } from "drizzle-orm";
import { curatorEdits, type Database } from "@lexius/db";
import type {
  CuratorEdit,
  CuratorEditAction,
  CuratorEditEntityType,
  CuratorEditRepository,
  CuratorEditInput,
  CuratorEditSource,
} from "@lexius/core";

export class DrizzleCuratorEditRepository implements CuratorEditRepository {
  constructor(private readonly db: Database) {}

  async insert(input: CuratorEditInput): Promise<CuratorEdit> {
    const [row] = await this.db
      .insert(curatorEdits)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        editorId: input.editorId,
        editorIp: input.editorIp ?? undefined,
        editorUa: input.editorUa,
        source: input.source,
        action: input.action,
        oldValues: input.oldValues,
        newValues: input.newValues,
        rowVersionBefore: input.rowVersionBefore,
        rowVersionAfter: input.rowVersionAfter,
        reason: input.reason,
        crossCheckResult: input.crossCheckResult,
      })
      .returning();
    return toCuratorEdit(row);
  }

  async findById(id: string): Promise<CuratorEdit | null> {
    const rows = await this.db
      .select()
      .from(curatorEdits)
      .where(eq(curatorEdits.id, id));
    return rows.length > 0 ? toCuratorEdit(rows[0]) : null;
  }

  async findByEntity(
    entityType: CuratorEditEntityType,
    entityId: string,
  ): Promise<CuratorEdit[]> {
    const rows = await this.db
      .select()
      .from(curatorEdits)
      .where(
        and(
          eq(curatorEdits.entityType, entityType),
          eq(curatorEdits.entityId, entityId),
        ),
      )
      .orderBy(desc(curatorEdits.editedAt));
    return rows.map(toCuratorEdit);
  }

  async findByEditor(editorId: string, since?: Date): Promise<CuratorEdit[]> {
    const conditions = [eq(curatorEdits.editorId, editorId)];
    if (since) conditions.push(gte(curatorEdits.editedAt, since));
    const rows = await this.db
      .select()
      .from(curatorEdits)
      .where(and(...conditions))
      .orderBy(desc(curatorEdits.editedAt));
    return rows.map(toCuratorEdit);
  }
}

function toCuratorEdit(row: typeof curatorEdits.$inferSelect): CuratorEdit {
  return {
    id: row.id,
    entityType: row.entityType as CuratorEditEntityType,
    entityId: row.entityId,
    editorId: row.editorId,
    editorIp: row.editorIp ?? null,
    editorUa: row.editorUa ?? null,
    source: row.source as CuratorEditSource,
    action: row.action as CuratorEditAction,
    oldValues: (row.oldValues as Record<string, unknown> | null) ?? null,
    newValues: row.newValues as Record<string, unknown>,
    rowVersionBefore: row.rowVersionBefore,
    rowVersionAfter: row.rowVersionAfter,
    reason: row.reason,
    crossCheckResult:
      (row.crossCheckResult as { ok: boolean; mismatches: unknown[] } | null) ??
      null,
    editedAt: row.editedAt,
  };
}
