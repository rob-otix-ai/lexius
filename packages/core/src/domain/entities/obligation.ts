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
}
