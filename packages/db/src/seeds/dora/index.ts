import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { seedLegislation } from "./legislation.js";
import { seedArticles } from "./articles.js";
import { seedRiskCategories } from "./risk-categories.js";
import { seedObligations } from "./obligations.js";
import { seedPenalties } from "./penalties.js";
import { seedDeadlines } from "./deadlines.js";
import { seedFaq } from "./faq.js";
import { seedDocRegister } from "./doc-register.js";

export async function seedDora(db: Database, embed: EmbeddingFn): Promise<void> {
  console.log("Starting DORA seed...");

  await seedLegislation(db);
  await seedArticles(db, embed);
  await seedDocRegister(db, embed);
  await seedRiskCategories(db, embed);
  await seedObligations(db, embed);
  await seedPenalties(db);
  await seedDeadlines(db);
  await seedFaq(db, embed);

  console.log("DORA seed complete.");
}

export const seed = seedDora;
