import { legislations } from "../../schema/index.js";
import type { Database } from "../../index.js";

export async function seedLegislation(db: Database) {
  console.log("Seeding legislation record...");

  await db
    .insert(legislations)
    .values({
      id: "dora",
      name: "Digital Operational Resilience Act (Regulation 2022/2554)",
      jurisdiction: "EU",
      effectiveDate: new Date("2025-01-17"),
      sourceUrl: "https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng",
      version: "1.0",
    })
    .onConflictDoUpdate({
      target: legislations.id,
      set: {
        name: "Digital Operational Resilience Act (Regulation 2022/2554)",
        jurisdiction: "EU",
        effectiveDate: new Date("2025-01-17"),
        sourceUrl: "https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng",
        version: "1.0",
      },
    });

  console.log("Legislation record seeded.");
}
