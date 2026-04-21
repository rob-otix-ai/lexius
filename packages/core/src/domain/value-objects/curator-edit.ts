export type CuratorEditEntityType = "obligation";

export type CuratorEditSource = "cli" | "agent" | "mcp" | "skill" | "wiki" | "api";

export type CuratorEditAction = "create" | "update" | "revert" | "deprecate";

export interface CuratorEdit {
  id: string;
  entityType: CuratorEditEntityType;
  entityId: string;
  editorId: string;
  editorIp: string | null;
  editorUa: string | null;
  source: CuratorEditSource;
  action: CuratorEditAction;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  rowVersionBefore: number | null;
  rowVersionAfter: number;
  reason: string;
  crossCheckResult: { ok: boolean; mismatches: unknown[] } | null;
  editedAt: Date;
}

export class ReasonRequired extends Error {
  constructor() {
    super("reason is required and must be non-empty");
    this.name = "ReasonRequired";
  }
}

export class RowVersionMismatch extends Error {
  readonly current: number;
  constructor(current: number) {
    super(`row_version mismatch: server has ${current}`);
    this.name = "RowVersionMismatch";
    this.current = current;
  }
}

export class AuthoritativeImmutable extends Error {
  constructor() {
    super("AUTHORITATIVE rows cannot be mutated");
    this.name = "AuthoritativeImmutable";
  }
}
