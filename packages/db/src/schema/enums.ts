import { pgEnum } from "drizzle-orm/pg-core";

export const provenanceTier = pgEnum("provenance_tier", [
  "AUTHORITATIVE",
  "CURATED",
  "AI_GENERATED",
]);

export const extractType = pgEnum("extract_type", [
  "fine_amount_eur",
  "turnover_percentage",
  "date",
  "article_cross_ref",
  "annex_cross_ref",
  "shall_clause",
  "annex_item",
]);

export type ExtractType = (typeof extractType.enumValues)[number];

export const findingType = pgEnum("finding_type", [
  "obligation",
  "penalty",
  "deadline",
  "cross_ref",
  "gap",
  "risk",
]);
