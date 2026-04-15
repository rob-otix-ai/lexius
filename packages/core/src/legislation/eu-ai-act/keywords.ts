import type { RiskCategory } from "../../domain/entities/risk-category.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";

interface CategoryScore {
  category: RiskCategory;
  strongCount: number;
  weakCount: number;
}

export function classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null {
  const lowerText = text.toLowerCase();

  const scores: CategoryScore[] = categories.map((category) => {
    let strongCount = 0;
    let weakCount = 0;

    for (const keyword of category.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        // Multi-word phrases count as strong matches
        if (lowerKeyword.includes(" ")) {
          strongCount++;
        } else {
          weakCount++;
        }
      }
    }

    return { category, strongCount, weakCount };
  });

  // Sort by strongCount desc, then weakCount desc
  scores.sort((a, b) => {
    if (b.strongCount !== a.strongCount) return b.strongCount - a.strongCount;
    return b.weakCount - a.weakCount;
  });

  const best = scores[0];

  // Require at least one strong match
  if (!best || best.strongCount < 1) {
    return null;
  }

  return {
    riskClassification: best.category.name,
    confidence: best.strongCount >= 2 ? "high" : "medium",
    matchedCategory: { name: best.category.name, level: best.category.level },
    relevantArticles: best.category.relevantArticles,
    roleDetermination: "unknown",
    obligationsSummary: `Matched risk category "${best.category.name}" (level ${best.category.level}) based on keyword analysis.`,
    matchedSignals: [],
    missingSignals: [],
    nextQuestions: [
      "What is your role (provider or deployer)?",
      "Are you a small or medium-sized enterprise (SME)?",
    ],
    basis: "text",
  };
}
