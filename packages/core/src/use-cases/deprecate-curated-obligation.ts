import type {
  ObligationRepository,
  CuratorEditRepository,
  CuratorEditInput,
  TransactionManager,
} from "../domain/ports/index.js";
import type { Obligation } from "../domain/entities/obligation.js";
import type { CuratorEditSource } from "../domain/value-objects/curator-edit.js";
import {
  AuthoritativeImmutable,
  ReasonRequired,
  RowVersionMismatch,
} from "../domain/value-objects/curator-edit.js";
import {
  ObligationNotFound,
  serialiseObligation,
} from "./update-curated-obligation.js";

export interface DeprecateCuratedObligationCmd {
  obligationId: string;
  rowVersion: number;
  editorId: string;
  editorIp?: string | null;
  editorUa?: string | null;
  source: CuratorEditSource;
  reason: string;
  dryRun?: boolean;
}

export class DeprecateCuratedObligation {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly tx: TransactionManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(cmd: DeprecateCuratedObligationCmd): Promise<{
    dryRun: boolean;
    obligation: Obligation | null;
  }> {
    if (!cmd.reason || cmd.reason.length === 0) throw new ReasonRequired();

    return this.tx.transactional(async (scope) => {
      const current = await scope.obligations.findById(cmd.obligationId);
      if (!current) throw new ObligationNotFound(cmd.obligationId);
      if (current.provenance.tier === "AUTHORITATIVE") {
        throw new AuthoritativeImmutable();
      }
      if (current.rowVersion !== cmd.rowVersion) {
        throw new RowVersionMismatch(current.rowVersion);
      }
      if (current.deprecatedAt) {
        // Already deprecated — idempotent no-op.
        return { dryRun: false, obligation: current };
      }

      if (cmd.dryRun) {
        return { dryRun: true, obligation: current };
      }

      const now = this.clock();
      const deprecated = await scope.obligations.deprecate(
        current.id,
        current.rowVersion,
        cmd.reason,
        now,
      );
      if (!deprecated) throw new RowVersionMismatch(current.rowVersion);

      const auditInput: CuratorEditInput = {
        entityType: "obligation",
        entityId: current.id,
        editorId: cmd.editorId,
        editorIp: cmd.editorIp ?? null,
        editorUa: cmd.editorUa ?? null,
        source: cmd.source,
        action: "deprecate",
        oldValues: serialiseObligation(current),
        newValues: serialiseObligation(deprecated),
        rowVersionBefore: current.rowVersion,
        rowVersionAfter: deprecated.rowVersion,
        reason: cmd.reason,
        crossCheckResult: null,
      };
      await scope.audit.insert(auditInput);

      return { dryRun: false, obligation: deprecated };
    });
  }
}
