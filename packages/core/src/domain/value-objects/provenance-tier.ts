export const PROVENANCE_TIERS = ["AUTHORITATIVE", "CURATED", "AI_GENERATED"] as const;
export type ProvenanceTier = (typeof PROVENANCE_TIERS)[number];

export function tierRank(tier: ProvenanceTier): number {
  switch (tier) {
    case "AUTHORITATIVE":
      return 3;
    case "CURATED":
      return 2;
    case "AI_GENERATED":
      return 1;
  }
}

export function atLeast(tier: ProvenanceTier, min: ProvenanceTier): boolean {
  return tierRank(tier) >= tierRank(min);
}
