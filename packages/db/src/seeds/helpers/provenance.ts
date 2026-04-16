export const SEED_REVIEWER = "seed:rob";

export function curatedSeedProvenance() {
  return {
    provenanceTier: "CURATED" as const,
    curatedBy: SEED_REVIEWER,
    reviewedAt: new Date(),
  };
}

export function aiSeedProvenance(model: string) {
  return {
    provenanceTier: "AI_GENERATED" as const,
    generatedByModel: model,
    generatedAt: new Date(),
  };
}
