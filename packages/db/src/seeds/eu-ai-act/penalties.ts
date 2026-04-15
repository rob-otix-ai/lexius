import { penalties } from "../../schema/index.js";
import type { Database } from "../../index.js";

const LEGISLATION_ID = "eu-ai-act";

const penaltyData = [
  {
    id: `${LEGISLATION_ID}-penalty-prohibited`,
    violationType: "prohibited-practices",
    name: "Prohibited AI practices violation",
    maxFineEur: "35000000",
    globalTurnoverPercentage: "7",
    article: "Art. 99(3)",
    description:
      "Non-compliance with prohibitions on AI practices under Article 5. This is the highest tier of penalties, reflecting the severity of deploying AI systems that pose unacceptable risks to fundamental rights and safety.",
    applicableTo: ["provider", "deployer", "operator"],
    smeRules: {
      description:
        "For SMEs including startups, the administrative fine shall be the lower of the two amounts: the fixed ceiling or the percentage of turnover. Per Article 99(6), the penalty caps for SMEs are proportionate, taking into account their economic viability.",
      article: "Art. 99(6)",
    },
  },
  {
    id: `${LEGISLATION_ID}-penalty-high-risk`,
    violationType: "high-risk-non-compliance",
    name: "High-risk AI system non-compliance",
    maxFineEur: "15000000",
    globalTurnoverPercentage: "3",
    article: "Art. 99(4)",
    description:
      "Non-compliance with obligations for high-risk AI systems under Articles 6-49, including requirements for risk management, data governance, technical documentation, transparency, human oversight, accuracy, robustness, conformity assessment, and deployer obligations.",
    applicableTo: ["provider", "deployer", "authorised-representative", "importer", "distributor"],
    smeRules: {
      description:
        "For SMEs including startups, the administrative fine shall be the lower of the two amounts: the fixed ceiling or the percentage of turnover. Per Article 99(6), the penalty caps for SMEs are proportionate, taking into account their economic viability.",
      article: "Art. 99(6)",
    },
  },
  {
    id: `${LEGISLATION_ID}-penalty-false-info`,
    violationType: "false-information",
    name: "Supply of incorrect, incomplete or misleading information",
    maxFineEur: "10000000",
    globalTurnoverPercentage: "2",
    article: "Art. 99(5)",
    description:
      "Supplying incorrect, incomplete or misleading information to notified bodies or national competent authorities in reply to a request. This tier ensures accountability and cooperation with regulatory oversight mechanisms.",
    applicableTo: ["provider", "deployer", "authorised-representative", "importer", "distributor"],
    smeRules: {
      description:
        "For SMEs including startups, the administrative fine shall be the lower of the two amounts: the fixed ceiling or the percentage of turnover. Per Article 99(6), the penalty caps for SMEs are proportionate, taking into account their economic viability.",
      article: "Art. 99(6)",
    },
  },
];

export async function seedPenalties(db: Database) {
  console.log("Seeding penalties...");

  for (const p of penaltyData) {
    await db
      .insert(penalties)
      .values({
        ...p,
        legislationId: LEGISLATION_ID,
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
          applicableTo: p.applicableTo,
          smeRules: p.smeRules,
        },
      });
  }

  console.log(`Seeded ${penaltyData.length} penalties.`);
}
