import { PROVENANCE_TIERS, type ProvenanceTier } from "./provenance-tier.js";

const ALLOWED: Record<ProvenanceTier, readonly ProvenanceTier[]> = {
  AUTHORITATIVE: [],
  AI_GENERATED: ["AI_GENERATED", "CURATED"],
  CURATED: ["CURATED"],
};

export class TierTransitionForbidden extends Error {
  readonly from: ProvenanceTier;
  readonly to: ProvenanceTier;
  constructor(from: ProvenanceTier, to: ProvenanceTier) {
    super(`Tier transition ${from} -> ${to} is not permitted`);
    this.name = "TierTransitionForbidden";
    this.from = from;
    this.to = to;
  }
}

export function assertTierTransition(
  from: ProvenanceTier,
  to: ProvenanceTier,
): void {
  if (!ALLOWED[from].includes(to)) {
    throw new TierTransitionForbidden(from, to);
  }
}

export function isTierTransitionAllowed(
  from: ProvenanceTier,
  to: ProvenanceTier,
): boolean {
  return ALLOWED[from].includes(to);
}

export const TIER_TRANSITION_MATRIX: ReadonlyArray<{
  from: ProvenanceTier;
  to: ProvenanceTier;
  allowed: boolean;
}> = PROVENANCE_TIERS.flatMap((from) =>
  PROVENANCE_TIERS.map((to) => ({
    from,
    to,
    allowed: ALLOWED[from].includes(to),
  })),
);
