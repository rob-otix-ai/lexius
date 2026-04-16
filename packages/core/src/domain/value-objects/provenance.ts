import type { ProvenanceTier } from "./provenance-tier.js";

export type Provenance =
  | {
      tier: "AUTHORITATIVE";
      sourceUrl: string;
      sourceHash: string;
      fetchedAt: Date;
      sourceFormat?: string;
    }
  | {
      tier: "CURATED";
      curatedBy: string;
      reviewedAt: Date;
      sourceUrl?: string;
    }
  | {
      tier: "AI_GENERATED";
      generatedByModel: string;
      generatedAt: Date;
    };

export function authoritative(
  p: Extract<Provenance, { tier: "AUTHORITATIVE" }>,
): Provenance {
  return { ...p, tier: "AUTHORITATIVE" };
}

export function curated(
  p: Omit<Extract<Provenance, { tier: "CURATED" }>, "tier">,
): Provenance {
  return { ...p, tier: "CURATED" };
}

export function aiGenerated(
  p: Omit<Extract<Provenance, { tier: "AI_GENERATED" }>, "tier">,
): Provenance {
  return { ...p, tier: "AI_GENERATED" };
}

export type { ProvenanceTier };
