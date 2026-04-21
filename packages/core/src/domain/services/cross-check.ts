// Cross-check domain service — validates that proposed curator values for
// numeric fields agree with the deterministic extracts derived from verbatim
// law. Called synchronously from curator write use cases so an edit that
// would break `pnpm crosscheck` is rejected at edit time, not at CI time.

export type CrossCheckEntityType = "obligation" | "penalty";

export interface CrossCheckInput {
  entityType: CrossCheckEntityType;
  entityId: string;
  derivedFrom: string[];
  proposedValues: Record<string, unknown>;
}

export interface CrossCheckMismatch {
  field: string;
  proposedValue: unknown;
  extractedValues: unknown[];
  derivedFrom: string[];
  suggestion: string;
}

export interface CrossCheckResult {
  ok: boolean;
  mismatches: CrossCheckMismatch[];
}

export interface CrossCheckService {
  run(input: CrossCheckInput): Promise<CrossCheckResult>;
}

export class CrossCheckFailed extends Error {
  readonly mismatches: CrossCheckMismatch[];
  constructor(mismatches: CrossCheckMismatch[]) {
    super(`cross-check failed: ${mismatches.length} mismatch(es)`);
    this.name = "CrossCheckFailed";
    this.mismatches = mismatches;
  }
}

// Fields per entity type that must agree with article_extracts before write.
// Obligations currently have no numerically-adjudicable fields (their cross-
// referenceable numbers live in penalties). Penalties adjudicate maxFineEur
// and globalTurnoverPercentage. This table is the single source of truth for
// which fields trigger a cross-check call.
const NUMERIC_FIELDS: Record<CrossCheckEntityType, readonly string[]> = {
  obligation: [],
  penalty: ["maxFineEur", "globalTurnoverPercentage"],
};

export function touchesNumericFields(
  entityType: CrossCheckEntityType,
  changes: Record<string, unknown>,
): boolean {
  return NUMERIC_FIELDS[entityType].some((f) => f in changes);
}

export function numericFieldsFor(entityType: CrossCheckEntityType): readonly string[] {
  return NUMERIC_FIELDS[entityType];
}
