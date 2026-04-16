import type { Provenance } from "../value-objects/provenance.js";

export interface Penalty {
  id: string;
  legislationId: string;
  violationType: string;
  name: string;
  maxFineEur: number;
  globalTurnoverPercentage: number;
  article: string;
  description: string;
  applicableTo: string[];
  smeRules: Record<string, unknown> | null;
  provenance: Provenance;
}
