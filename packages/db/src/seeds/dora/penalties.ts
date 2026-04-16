import { penalties } from "../../schema/index.js";
import type { Database } from "../../index.js";

const LEGISLATION_ID = "dora";

const penaltyData = [
  {
    id: `${LEGISLATION_ID}-penalty-general-non-compliance`,
    violationType: "general-non-compliance",
    name: "General DORA non-compliance by financial entities",
    maxFineEur: "2000000",
    globalTurnoverPercentage: "2",
    article: "Art. 50",
    description:
      "Administrative penalties and remedial measures imposed by competent authorities on financial entities for infringements of DORA, including breaches of ICT risk management, incident reporting, testing and third-party risk management obligations. Levels vary by Member State but must be effective, proportionate and dissuasive. The baseline fine of EUR 2,000,000 and up to 2% of total annual worldwide turnover is indicative of typical national maxima for serious infringements.",
    applicableTo: ["financial-entity"],
    smeRules: {
      description:
        "Under Article 51, competent authorities must take into account the materiality, gravity and duration of the breach, the degree of responsibility, the financial strength of the entity (in particular its annual turnover), profits gained or losses avoided, prior breaches, and the level of cooperation with the authority. Proportionality applies particularly to SMEs and microenterprises, which benefit from the simplified framework under Article 16.",
      article: "Art. 51",
    },
  },
  {
    id: `${LEGISLATION_ID}-penalty-ctpp-non-compliance`,
    violationType: "ctpp-non-compliance",
    name: "Critical ICT Third-Party Provider non-compliance",
    maxFineEur: "5000000",
    globalTurnoverPercentage: "1",
    article: "Art. 35",
    description:
      "Periodic penalty payments imposed by the Lead Overseer on Critical ICT Third-Party Service Providers (CTPPs) that fail to comply with measures required under Article 35 on the Oversight Framework. The Lead Overseer may impose periodic penalty payments of up to 1% of the daily average worldwide turnover of the CTPP in the preceding business year, imposed on a daily basis for up to six months from the date specified in the decision.",
    applicableTo: ["ctpp"],
    smeRules: null,
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
