import { eq } from "drizzle-orm";
import { legislations } from "../../schema/index.js";
import type { Database } from "../../index.js";

export async function seedLegislation(db: Database) {
  console.log("Seeding legislation record...");

  await db
    .insert(legislations)
    .values({
      id: "eu-ai-act",
      name: "EU AI Act (Regulation 2024/1689)",
      jurisdiction: "EU",
      effectiveDate: new Date("2024-08-01"),
      sourceUrl:
        "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
      version: "1.0",
    })
    .onConflictDoUpdate({
      target: legislations.id,
      set: {
        name: "EU AI Act (Regulation 2024/1689)",
        jurisdiction: "EU",
        effectiveDate: new Date("2024-08-01"),
        sourceUrl:
          "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
        version: "1.0",
      },
    });

  console.log("Legislation record seeded.");
}
