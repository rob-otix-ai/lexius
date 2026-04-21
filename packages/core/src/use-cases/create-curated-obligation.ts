import type {
  ObligationRepository,
  CuratorEditRepository,
  CuratorEditInput,
  TransactionManager,
  EmbeddingService,
} from "../domain/ports/index.js";
import type {
  Obligation,
  CreateObligationInput,
} from "../domain/entities/obligation.js";
import type { CuratorEditSource } from "../domain/value-objects/curator-edit.js";
import { ReasonRequired } from "../domain/value-objects/curator-edit.js";
import {
  assertDerivedFromNonEmpty,
  assertDerivedFromResolves,
} from "../domain/services/derived-from.js";
import { serialiseObligation } from "./update-curated-obligation.js";

export interface CreateCuratedObligationCmd {
  obligation: CreateObligationInput;
  editorId: string;
  editorIp?: string | null;
  editorUa?: string | null;
  source: CuratorEditSource;
  reason: string;
  dryRun?: boolean;
}

export class CreateCuratedObligation {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly embeddings: EmbeddingService,
    private readonly tx: TransactionManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(cmd: CreateCuratedObligationCmd): Promise<{
    dryRun: boolean;
    obligation: Obligation | null;
  }> {
    if (!cmd.reason || cmd.reason.length === 0) throw new ReasonRequired();
    assertDerivedFromNonEmpty(cmd.obligation.derivedFrom);

    return this.tx.transactional(async (scope) => {
      // C-INT-007: every anchor must resolve to an existing article.
      await assertDerivedFromResolves(scope.articles, cmd.obligation.derivedFrom);

      const text = [
        cmd.obligation.obligation,
        cmd.obligation.details,
        cmd.obligation.role,
        cmd.obligation.riskLevel,
      ]
        .filter(Boolean)
        .join("\n");
      const embedding = await this.embeddings.embed(text);
      const now = this.clock();

      if (cmd.dryRun) {
        return {
          dryRun: true,
          obligation: null,
        };
      }

      const created = await scope.obligations.create(
        cmd.obligation,
        cmd.editorId,
        now,
        embedding,
      );

      const auditInput: CuratorEditInput = {
        entityType: "obligation",
        entityId: created.id,
        editorId: cmd.editorId,
        editorIp: cmd.editorIp ?? null,
        editorUa: cmd.editorUa ?? null,
        source: cmd.source,
        action: "create",
        oldValues: null,
        newValues: serialiseObligation(created),
        rowVersionBefore: null,
        rowVersionAfter: created.rowVersion,
        reason: cmd.reason,
        crossCheckResult: { ok: true, mismatches: [] },
      };
      await scope.audit.insert(auditInput);

      return { dryRun: false, obligation: created };
    });
  }
}
