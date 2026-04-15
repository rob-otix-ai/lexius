import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { seedLegislation } from "./legislation.js";
import { seedArticles } from "./articles.js";
import { seedRiskCategories } from "./risk-categories.js";
import { seedObligations } from "./obligations.js";
import { seedPenalties } from "./penalties.js";
import { seedDeadlines } from "./deadlines.js";
import { seedFaq } from "./faq.js";
import { seedAnnexIv } from "./annex-iv.js";

export async function seed(db: Database, embed: EmbeddingFn) {
  console.log("Starting EU AI Act seed...");

  await seedLegislation(db);
  await seedArticles(db, embed);
  await seedAnnexIv(db, embed);
  await seedRiskCategories(db, embed);
  await seedObligations(db, embed);
  await seedPenalties(db);
  await seedDeadlines(db);
  await seedFaq(db, embed);

  console.log("EU AI Act seed complete.");
}
