import { deadlines } from "../../schema/index.js";
import type { Database } from "../../index.js";

const LEGISLATION_ID = "eu-ai-act";

const deadlineData = [
  {
    id: `${LEGISLATION_ID}-deadline-entry-into-force`,
    date: new Date("2024-08-01"),
    event: "Entry into force",
    description:
      "The EU AI Act (Regulation 2024/1689) enters into force. The regulation was published in the Official Journal of the EU on 12 July 2024 and enters into force 20 days after publication.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-prohibitions`,
    date: new Date("2025-02-02"),
    event: "Prohibitions and AI literacy apply",
    description:
      "Prohibited AI practices under Article 5 become enforceable. The obligation for AI literacy under Article 4 also applies from this date. Organisations must have ceased any prohibited AI practices and ensured staff AI literacy.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-gpai`,
    date: new Date("2025-08-02"),
    event: "GPAI rules and governance apply",
    description:
      "Rules for general-purpose AI models (Articles 51-56) and governance provisions become applicable. GPAI model providers must comply with transparency, documentation, copyright, and systemic risk obligations.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-high-risk`,
    date: new Date("2026-08-02"),
    event: "High-risk AI system obligations apply",
    description:
      "The main body of obligations for high-risk AI systems becomes applicable. This includes requirements for providers (Articles 9-17, 43, 47, 49, 72) and deployers (Articles 26-27) of high-risk AI systems classified under Annex III.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-annex-i`,
    date: new Date("2027-08-02"),
    event: "Annex I product obligations apply",
    description:
      "Requirements for high-risk AI systems that are safety components of, or themselves constitute, products covered by EU harmonisation legislation listed in Annex I become applicable. These include AI systems in machinery, toys, lifts, medical devices, and other regulated products.",
  },
];

export async function seedDeadlines(db: Database) {
  console.log("Seeding deadlines...");

  for (const d of deadlineData) {
    await db
      .insert(deadlines)
      .values({
        ...d,
        legislationId: LEGISLATION_ID,
      })
      .onConflictDoUpdate({
        target: deadlines.id,
        set: {
          date: d.date,
          event: d.event,
          description: d.description,
        },
      });
  }

  console.log(`Seeded ${deadlineData.length} deadlines.`);
}
