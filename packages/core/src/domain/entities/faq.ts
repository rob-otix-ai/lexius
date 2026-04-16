import type { Provenance } from "../value-objects/provenance.js";

export interface FAQ {
  id: string;
  legislationId: string;
  question: string;
  answer: string;
  articleReferences: string[];
  keywords: string[];
  category: string;
  sourceUrl: string | null;
  derivedFrom: string[];
  provenance: Provenance;
}
