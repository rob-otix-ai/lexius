import type {
  CuratorEdit,
  CuratorEditEntityType,
} from "../value-objects/curator-edit.js";

export interface CuratorEditInput {
  entityType: CuratorEditEntityType;
  entityId: string;
  editorId: string;
  editorIp: string | null;
  editorUa: string | null;
  source: CuratorEdit["source"];
  action: CuratorEdit["action"];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  rowVersionBefore: number | null;
  rowVersionAfter: number;
  reason: string;
  crossCheckResult: CuratorEdit["crossCheckResult"];
}

export interface CuratorEditRepository {
  insert(input: CuratorEditInput): Promise<CuratorEdit>;
  findById(id: string): Promise<CuratorEdit | null>;
  findByEntity(
    entityType: CuratorEditEntityType,
    entityId: string,
  ): Promise<CuratorEdit[]>;
  findByEditor(editorId: string, since?: Date): Promise<CuratorEdit[]>;
}
