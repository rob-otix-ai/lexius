import { legislations } from "../schema/index.js";
import type { Database } from "../index.js";

const additionalLegislations = [
  {
    id: "gdpr",
    name: "General Data Protection Regulation (Regulation 2016/679)",
    jurisdiction: "EU",
    effectiveDate: new Date("2018-05-25"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
    version: "1.0",
  },
  {
    id: "digital-services-act",
    name: "Digital Services Act (Regulation 2022/2065)",
    jurisdiction: "EU",
    effectiveDate: new Date("2024-02-17"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065",
    version: "1.0",
  },
  {
    id: "digital-markets-act",
    name: "Digital Markets Act (Regulation 2022/1925)",
    jurisdiction: "EU",
    effectiveDate: new Date("2023-05-02"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R1925",
    version: "1.0",
  },
  {
    id: "data-act",
    name: "Data Act (Regulation 2023/2854)",
    jurisdiction: "EU",
    effectiveDate: new Date("2025-09-12"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R2854",
    version: "1.0",
  },
  {
    id: "data-governance-act",
    name: "Data Governance Act (Regulation 2022/868)",
    jurisdiction: "EU",
    effectiveDate: new Date("2023-09-24"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R0868",
    version: "1.0",
  },
  {
    id: "cyber-resilience-act",
    name: "Cyber Resilience Act (Regulation 2024/2847)",
    jurisdiction: "EU",
    effectiveDate: new Date("2027-12-11"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R2847",
    version: "1.0",
  },
  {
    id: "mica",
    name: "Markets in Crypto-Assets Regulation (Regulation 2023/1114)",
    jurisdiction: "EU",
    effectiveDate: new Date("2024-12-30"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1114",
    version: "1.0",
  },
  {
    id: "eidas2",
    name: "European Digital Identity Regulation (Regulation 2024/1183)",
    jurisdiction: "EU",
    effectiveDate: new Date("2024-05-20"),
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1183",
    version: "1.0",
  },
];

export async function seedAdditionalLegislations(db: Database) {
  console.log("Seeding additional legislations...");

  for (const leg of additionalLegislations) {
    await db
      .insert(legislations)
      .values(leg)
      .onConflictDoUpdate({
        target: legislations.id,
        set: {
          name: leg.name,
          jurisdiction: leg.jurisdiction,
          effectiveDate: leg.effectiveDate,
          sourceUrl: leg.sourceUrl,
          version: leg.version,
        },
      });
  }

  console.log(`Seeded ${additionalLegislations.length} additional legislations.`);
}

export const CELEX_MAP: Record<string, string> = {
  gdpr: "32016R0679",
  "digital-services-act": "32022R2065",
  "digital-markets-act": "32022R1925",
  "data-act": "32023R2854",
  "data-governance-act": "32022R0868",
  "cyber-resilience-act": "32024R2847",
  mica: "32023R1114",
  eidas2: "32024R1183",
};
