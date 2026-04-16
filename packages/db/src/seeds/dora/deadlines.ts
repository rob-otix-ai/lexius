import { deadlines } from "../../schema/index.js";
import type { Database } from "../../index.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "dora";

const deadlineData = [
  {
    id: `${LEGISLATION_ID}-deadline-entry-into-force`,
    date: new Date("2023-01-16"),
    event: "DORA enters into force",
    description:
      "Regulation (EU) 2022/2554 (DORA) enters into force on 16 January 2023, the twentieth day following its publication in the Official Journal of the European Union (L 333 of 27 December 2022). From this date, the European Supervisory Authorities begin developing the Regulatory Technical Standards (RTS) and Implementing Technical Standards (ITS).",
  },
  {
    id: `${LEGISLATION_ID}-deadline-first-rts-batch`,
    date: new Date("2024-07-17"),
    event: "First batch of RTS/ITS adopted",
    description:
      "The first batch of DORA Regulatory and Implementing Technical Standards is adopted by the ESAs and submitted to the European Commission for endorsement. This batch covers the ICT risk management framework, simplified ICT RMF under Article 16, criteria for classification of ICT-related incidents, and the templates for the Register of Information.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-date-of-application`,
    date: new Date("2025-01-17"),
    event: "DORA date of application — financial entities must be compliant",
    description:
      "DORA applies from 17 January 2025. From this date, all in-scope financial entities must fully comply with the ICT risk management framework, incident management and reporting, digital operational resilience testing, and ICT third-party risk management obligations. The Oversight Framework for Critical ICT Third-Party Service Providers also becomes operational.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-first-register-submission`,
    date: new Date("2025-04-30"),
    event: "First Register of Information submission deadline",
    description:
      "The first annual submission of the Register of Information on ICT third-party contractual arrangements by financial entities to their competent authorities is due by 30 April 2025. Competent authorities in turn forward aggregated registers to the ESAs for the purposes of the critical ICT third-party provider designation exercise.",
  },
  {
    id: `${LEGISLATION_ID}-deadline-first-ctpp-designation`,
    date: new Date("2025-11-18"),
    event: "First list of designated Critical ICT Third-Party Providers published by the ESAs",
    description:
      "The ESAs Joint Committee publishes the first list of ICT third-party service providers designated as critical (CTPPs) under Article 31, following assessment of the information collected from financial entities via the Register of Information. Designated CTPPs are notified and become subject to the Union-level Oversight Framework led by the relevant Lead Overseer (EBA, EIOPA or ESMA).",
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
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: deadlines.id,
        set: {
          date: d.date,
          event: d.event,
          description: d.description,
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${deadlineData.length} deadlines.`);
}
