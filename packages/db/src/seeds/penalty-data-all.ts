import { penalties } from "../schema/index.js";
import type { Database } from "../index.js";
import { curatedSeedProvenance } from "./helpers/index.js";

const penaltyData = [
  // GDPR
  {
    id: "gdpr-penalty-serious",
    legislationId: "gdpr",
    violationType: "serious-violations",
    name: "Serious GDPR violations (data subject rights, international transfers, supervisory authority orders)",
    maxFineEur: "20000000",
    globalTurnoverPercentage: "4",
    article: "Art. 83(5)/(6)",
    description: "Infringements of basic principles, data subject rights, international transfers, or non-compliance with supervisory authority orders.",
    derivedFrom: [],
  },
  {
    id: "gdpr-penalty-general",
    legislationId: "gdpr",
    violationType: "general-non-compliance",
    name: "General GDPR non-compliance (controller/processor obligations)",
    maxFineEur: "10000000",
    globalTurnoverPercentage: "2",
    article: "Art. 83(4)",
    description: "Infringements of controller and processor obligations, certification body obligations, or monitoring body obligations.",
    derivedFrom: [],
  },
  // Digital Services Act
  {
    id: "dsa-penalty-vlop",
    legislationId: "digital-services-act",
    violationType: "vlop-non-compliance",
    name: "VLOP/VLOSE non-compliance",
    maxFineEur: "0",
    globalTurnoverPercentage: "6",
    article: "Art. 74(1)",
    description: "Non-compliance by very large online platforms or search engines with obligations under this Regulation.",
    derivedFrom: [],
  },
  {
    id: "dsa-penalty-false-info",
    legislationId: "digital-services-act",
    violationType: "false-information",
    name: "Supply of incorrect or misleading information",
    maxFineEur: "0",
    globalTurnoverPercentage: "1",
    article: "Art. 74(3)",
    description: "Supply of incorrect, incomplete or misleading information in response to regulatory requests.",
    derivedFrom: [],
  },
  // Digital Markets Act
  {
    id: "dma-penalty-non-compliance",
    legislationId: "digital-markets-act",
    violationType: "gatekeeper-non-compliance",
    name: "Gatekeeper non-compliance",
    maxFineEur: "0",
    globalTurnoverPercentage: "10",
    article: "Art. 30(1)",
    description: "Non-compliance by a gatekeeper with core platform service obligations.",
    derivedFrom: [],
  },
  {
    id: "dma-penalty-systematic",
    legislationId: "digital-markets-act",
    violationType: "systematic-non-compliance",
    name: "Systematic gatekeeper non-compliance",
    maxFineEur: "0",
    globalTurnoverPercentage: "20",
    article: "Art. 30(2)",
    description: "Systematic non-compliance with gatekeeper obligations.",
    derivedFrom: [],
  },
  {
    id: "dma-penalty-procedural",
    legislationId: "digital-markets-act",
    violationType: "procedural-violations",
    name: "Procedural violations",
    maxFineEur: "0",
    globalTurnoverPercentage: "1",
    article: "Art. 31(3)",
    description: "Supply of incorrect or misleading information or failure to comply with procedural requirements.",
    derivedFrom: [],
  },
  // Cyber Resilience Act
  {
    id: "cra-penalty-essential",
    legislationId: "cyber-resilience-act",
    violationType: "essential-requirements",
    name: "Essential cybersecurity requirement violations",
    maxFineEur: "15000000",
    globalTurnoverPercentage: "5",
    article: "Art. 64(2)",
    description: "Non-compliance with essential cybersecurity requirements set out in Annex I.",
    derivedFrom: [],
  },
  {
    id: "cra-penalty-obligations",
    legislationId: "cyber-resilience-act",
    violationType: "obligation-non-compliance",
    name: "Operator obligation non-compliance",
    maxFineEur: "10000000",
    globalTurnoverPercentage: "2",
    article: "Art. 64(3)",
    description: "Non-compliance with obligations for manufacturers, importers, and distributors.",
    derivedFrom: [],
  },
  {
    id: "cra-penalty-false-info",
    legislationId: "cyber-resilience-act",
    violationType: "false-information",
    name: "Supply of false information",
    maxFineEur: "5000000",
    globalTurnoverPercentage: "1",
    article: "Art. 64(4)",
    description: "Supply of incorrect, incomplete, or misleading information to notified bodies or market surveillance authorities.",
    derivedFrom: [],
  },
  // MiCA
  {
    id: "mica-penalty-serious",
    legislationId: "mica",
    violationType: "serious-violations",
    name: "Serious MiCA violations",
    maxFineEur: "15000000",
    globalTurnoverPercentage: "15",
    article: "Art. 111(5)",
    description: "Serious infringements related to crypto-asset service providers.",
    derivedFrom: [],
  },
  {
    id: "mica-penalty-general",
    legislationId: "mica",
    violationType: "general-non-compliance",
    name: "General MiCA non-compliance",
    maxFineEur: "5000000",
    globalTurnoverPercentage: "5",
    article: "Art. 111(3)",
    description: "General infringements by crypto-asset service providers.",
    derivedFrom: [],
  },
  {
    id: "mica-penalty-minor",
    legislationId: "mica",
    violationType: "minor-violations",
    name: "Minor MiCA violations",
    maxFineEur: "700000",
    globalTurnoverPercentage: "3",
    article: "Art. 111(2)",
    description: "Minor administrative violations by crypto-asset service providers.",
    derivedFrom: [],
  },
  // eIDAS 2.0
  {
    id: "eidas2-penalty-trust-services",
    legislationId: "eidas2",
    violationType: "trust-service-violations",
    name: "Trust service provider violations",
    maxFineEur: "5000000",
    globalTurnoverPercentage: "1",
    article: "Art. 16a(2)",
    description: "Infringements by qualified and non-qualified trust service providers.",
    derivedFrom: [],
  },
];

export async function seedAllPenalties(db: Database) {
  console.log("Seeding penalties for all legislations...");

  for (const p of penaltyData) {
    await db
      .insert(penalties)
      .values({
        ...p,
        applicableTo: [],
        extractExempt: false,
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: penalties.id,
        set: {
          violationType: p.violationType,
          name: p.name,
          maxFineEur: p.maxFineEur,
          globalTurnoverPercentage: p.globalTurnoverPercentage,
          article: p.article,
          description: p.description,
          derivedFrom: p.derivedFrom,
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${penaltyData.length} penalties across ${new Set(penaltyData.map((p) => p.legislationId)).size} legislations.`);
}
