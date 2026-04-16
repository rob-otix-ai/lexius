import { pgEnum } from "drizzle-orm/pg-core";

export const provenanceTier = pgEnum("provenance_tier", [
  "AUTHORITATIVE",
  "CURATED",
  "AI_GENERATED",
]);
