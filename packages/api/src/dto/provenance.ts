import type { Provenance } from "@lexius/core";

export interface ProvenanceDTO {
  tier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
  sourceUrl: string | null;
  sourceHash: string | null;
  fetchedAt: string | null;
  curatedBy: string | null;
  reviewedAt: string | null;
  generatedByModel: string | null;
  generatedAt: string | null;
}

/**
 * Flattens the domain Provenance discriminated union to a flat DTO where
 * fields not applicable to the tier are returned as null.
 */
export function toProvenanceDTO(p: Provenance): ProvenanceDTO {
  switch (p.tier) {
    case "AUTHORITATIVE":
      return {
        tier: "AUTHORITATIVE",
        sourceUrl: p.sourceUrl,
        sourceHash: p.sourceHash,
        fetchedAt: p.fetchedAt.toISOString(),
        curatedBy: null,
        reviewedAt: null,
        generatedByModel: null,
        generatedAt: null,
      };
    case "CURATED":
      return {
        tier: "CURATED",
        sourceUrl: p.sourceUrl ?? null,
        sourceHash: null,
        fetchedAt: null,
        curatedBy: p.curatedBy,
        reviewedAt: p.reviewedAt.toISOString(),
        generatedByModel: null,
        generatedAt: null,
      };
    case "AI_GENERATED":
      return {
        tier: "AI_GENERATED",
        sourceUrl: null,
        sourceHash: null,
        fetchedAt: null,
        curatedBy: null,
        reviewedAt: null,
        generatedByModel: p.generatedByModel,
        generatedAt: p.generatedAt.toISOString(),
      };
  }
}
