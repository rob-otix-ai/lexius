import type {
  ObligationRepository,
  CuratorEditRepository,
  CuratorEditInput,
  TransactionManager,
  EmbeddingService,
} from "../domain/ports/index.js";
import type {
  Obligation,
  ObligationMutableFields,
} from "../domain/entities/obligation.js";
import type { CuratorEditSource } from "../domain/value-objects/curator-edit.js";
import { ReasonRequired } from "../domain/value-objects/curator-edit.js";
import {
  ObligationNotFound,
  serialiseObligation,
} from "./update-curated-obligation.js";

export interface RevertCuratorEditCmd {
  editId: string;
  editorId: string;
  editorIp?: string | null;
  editorUa?: string | null;
  source: CuratorEditSource;
  reason: string;
  dryRun?: boolean;
}

export class EditNotFound extends Error {
  constructor(id: string) {
    super(`curator edit ${id} not found`);
    this.name = "EditNotFound";
  }
}

export class EditNotRevertable extends Error {
  constructor(reason: string) {
    super(`edit is not revertable: ${reason}`);
    this.name = "EditNotRevertable";
  }
}

const MUTABLE_KEYS: ReadonlyArray<keyof ObligationMutableFields> = [
  "role",
  "riskLevel",
  "obligation",
  "article",
  "deadline",
  "details",
  "category",
];

export class RevertCuratorEdit {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly embeddings: EmbeddingService,
    private readonly tx: TransactionManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(cmd: RevertCuratorEditCmd): Promise<{
    dryRun: boolean;
    obligation: Obligation | null;
  }> {
    if (!cmd.reason || cmd.reason.length === 0) throw new ReasonRequired();

    return this.tx.transactional(async (scope) => {
      const edit = await scope.audit.findById(cmd.editId);
      if (!edit) throw new EditNotFound(cmd.editId);
      if (edit.action === "create") {
        throw new EditNotRevertable(
          "create edits are reverted via deprecate, not revert",
        );
      }
      if (!edit.oldValues) {
        throw new EditNotRevertable("edit has no old_values to restore");
      }

      const current = await scope.obligations.findById(edit.entityId);
      if (!current) throw new ObligationNotFound(edit.entityId);

      const restore: ObligationMutableFields = {};
      for (const key of MUTABLE_KEYS) {
        if (key in edit.oldValues) {
          const value = edit.oldValues[key];
          if (key === "deadline") {
            restore.deadline = value ? new Date(value as string) : null;
          } else {
            (restore as Record<string, unknown>)[key] = value;
          }
        }
      }

      const embeddingInput = [
        restore.obligation ?? current.obligation,
        restore.details ?? current.details,
        restore.role ?? current.role,
        restore.riskLevel ?? current.riskLevel,
      ]
        .filter(Boolean)
        .join("\n");
      const newEmbedding = await this.embeddings.embed(embeddingInput);
      const now = this.clock();

      if (cmd.dryRun) {
        return { dryRun: true, obligation: current };
      }

      const updated = await scope.obligations.update(
        current.id,
        current.rowVersion,
        restore,
        cmd.editorId,
        now,
        newEmbedding,
        true,
      );
      if (!updated) {
        throw new EditNotRevertable(
          `row_version drifted since ${edit.editedAt.toISOString()}`,
        );
      }

      const auditInput: CuratorEditInput = {
        entityType: "obligation",
        entityId: current.id,
        editorId: cmd.editorId,
        editorIp: cmd.editorIp ?? null,
        editorUa: cmd.editorUa ?? null,
        source: cmd.source,
        action: "revert",
        oldValues: serialiseObligation(current),
        newValues: serialiseObligation(updated),
        rowVersionBefore: current.rowVersion,
        rowVersionAfter: updated.rowVersion,
        reason: cmd.reason,
        crossCheckResult: { ok: true, mismatches: [] },
      };
      await scope.audit.insert(auditInput);

      return { dryRun: false, obligation: updated };
    });
  }
}
