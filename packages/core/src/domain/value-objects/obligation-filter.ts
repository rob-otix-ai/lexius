import type { ProvenanceTier } from "./provenance-tier.js";

export interface ObligationFilter {
  legislationId: string;
  role?: string;
  riskLevel?: string;
  category?: string;
  /**
   * Minimum provenance tier to include in the result. Rows with a lower
   * tier rank are suppressed. Tier ranks: AUTHORITATIVE=3, CURATED=2,
   * AI_GENERATED=1 (see {@link tierRank}).
   */
  minTier?: ProvenanceTier;
}
