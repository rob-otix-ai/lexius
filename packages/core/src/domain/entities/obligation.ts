import type { Provenance } from "../value-objects/provenance.js";

export interface Obligation {
  id: string;
  legislationId: string;
  role: string;
  riskLevel: string;
  obligation: string;
  article: string;
  deadline: Date | null;
  details: string;
  category: string;
  derivedFrom: string[];
  provenance: Provenance;
  rowVersion: number;
  needsReview: boolean;
  staleSince: Date | null;
  deprecatedAt: Date | null;
  deprecatedReason: string | null;
}

// Fields a curator is allowed to change on a CURATED obligation.
// Does NOT include id, legislationId, derivedFrom (immutable per C-INT-004),
// provenance fields (managed by the use case), or any row_version /
// lifecycle columns.
export type ObligationMutableFields = Partial<
  Pick<
    Obligation,
    | "role"
    | "riskLevel"
    | "obligation"
    | "article"
    | "deadline"
    | "details"
    | "category"
  >
>;

// Full shape required to create a new CURATED obligation.
export interface CreateObligationInput {
  id: string;
  legislationId: string;
  role: string;
  riskLevel: string;
  obligation: string;
  article: string;
  deadline: Date | null;
  details: string;
  category: string;
  derivedFrom: string[];
}
