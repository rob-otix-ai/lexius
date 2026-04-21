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
import {
  AuthoritativeImmutable,
  ReasonRequired,
  RowVersionMismatch,
} from "../domain/value-objects/curator-edit.js";
import {
  assertTierTransition,
} from "../domain/value-objects/tier-transition.js";
import {
  type CrossCheckService,
  CrossCheckFailed,
  touchesNumericFields,
} from "../domain/services/cross-check.js";

export interface UpdateCuratedObligationInput {
  obligationId: string;
  rowVersion: number;
  editorId: string;
  editorIp?: string | null;
  editorUa?: string | null;
  source: CuratorEditSource;
  reason: string;
  changes: ObligationMutableFields;
  dryRun?: boolean;
}

export interface UpdateCuratedObligationResult {
  dryRun: boolean;
  obligation: Obligation | null;
  crossCheckResult: { ok: true };
  embeddingRegenerated: boolean;
}

export class ObligationNotFound extends Error {
  constructor(id: string) {
    super(`obligation ${id} not found`);
    this.name = "ObligationNotFound";
  }
}

export class DerivedFromImmutable extends Error {
  constructor() {
    super("derivedFrom is immutable on CURATED obligations (C-INT-004)");
    this.name = "DerivedFromImmutable";
  }
}

const TEXT_FIELDS: ReadonlyArray<keyof ObligationMutableFields> = [
  "obligation",
  "details",
  "category",
  "role",
  "riskLevel",
  "article",
];

function touchesTextFields(changes: ObligationMutableFields): boolean {
  return TEXT_FIELDS.some((f) => f in changes);
}

function buildEmbeddingInput(
  current: Obligation,
  changes: ObligationMutableFields,
): string {
  const next = { ...current, ...changes };
  return [next.obligation, next.details, next.role, next.riskLevel]
    .filter(Boolean)
    .join("\n");
}

export class UpdateCuratedObligation {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly embeddings: EmbeddingService,
    private readonly crossCheck: CrossCheckService,
    private readonly tx: TransactionManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    input: UpdateCuratedObligationInput,
  ): Promise<UpdateCuratedObligationResult> {
    if (!input.reason || input.reason.length === 0) throw new ReasonRequired();
    if ("derivedFrom" in (input.changes as Record<string, unknown>)) {
      throw new DerivedFromImmutable();
    }

    return this.tx.transactional(async (scope) => {
      const current = await scope.obligations.findById(input.obligationId);
      if (!current) throw new ObligationNotFound(input.obligationId);
      if (current.provenance.tier === "AUTHORITATIVE") {
        throw new AuthoritativeImmutable();
      }
      if (current.rowVersion !== input.rowVersion) {
        throw new RowVersionMismatch(current.rowVersion);
      }

      // Transition stays within the same tier (update path does not promote).
      assertTierTransition(current.provenance.tier, current.provenance.tier);

      const proposed: Obligation = { ...current, ...input.changes };

      if (touchesNumericFields("obligation", input.changes as Record<string, unknown>)) {
        const check = await this.crossCheck.run({
          entityType: "obligation",
          entityId: current.id,
          derivedFrom: current.derivedFrom,
          proposedValues: input.changes as Record<string, unknown>,
        });
        if (!check.ok) throw new CrossCheckFailed(check.mismatches);
      }

      const embeddingChanged = touchesTextFields(input.changes);
      const newEmbedding = embeddingChanged
        ? await this.embeddings.embed(buildEmbeddingInput(current, input.changes))
        : null;

      if (input.dryRun) {
        return {
          dryRun: true,
          obligation: proposed,
          crossCheckResult: { ok: true } as const,
          embeddingRegenerated: embeddingChanged,
        };
      }

      const now = this.clock();
      const updated = await scope.obligations.update(
        current.id,
        current.rowVersion,
        input.changes,
        input.editorId,
        now,
        newEmbedding,
        true, // clear stale flags on successful edit
      );
      if (!updated) {
        // Repository returns null when expected row_version has drifted —
        // another transaction committed between findById and update.
        throw new RowVersionMismatch(current.rowVersion);
      }

      const auditInput: CuratorEditInput = {
        entityType: "obligation",
        entityId: current.id,
        editorId: input.editorId,
        editorIp: input.editorIp ?? null,
        editorUa: input.editorUa ?? null,
        source: input.source,
        action: "update",
        oldValues: serialiseObligation(current),
        newValues: serialiseObligation(updated),
        rowVersionBefore: current.rowVersion,
        rowVersionAfter: updated.rowVersion,
        reason: input.reason,
        crossCheckResult: { ok: true, mismatches: [] },
      };
      await scope.audit.insert(auditInput);

      return {
        dryRun: false,
        obligation: updated,
        crossCheckResult: { ok: true } as const,
        embeddingRegenerated: embeddingChanged,
      };
    });
  }
}

function serialiseObligation(o: Obligation): Record<string, unknown> {
  return {
    id: o.id,
    legislationId: o.legislationId,
    role: o.role,
    riskLevel: o.riskLevel,
    obligation: o.obligation,
    article: o.article,
    deadline: o.deadline?.toISOString() ?? null,
    details: o.details,
    category: o.category,
    derivedFrom: o.derivedFrom,
    provenanceTier: o.provenance.tier,
    rowVersion: o.rowVersion,
    needsReview: o.needsReview,
    deprecatedAt: o.deprecatedAt?.toISOString() ?? null,
  };
}

export { serialiseObligation };
