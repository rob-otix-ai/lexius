import type { Provenance } from "../value-objects/provenance.js";

export interface Deadline {
  id: string;
  legislationId: string;
  date: Date;
  event: string;
  description: string;
  provenance: Provenance;
}
