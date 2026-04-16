import type { ClassifyOutput } from "../../domain/value-objects/classify.js";
import type { RiskCategory } from "../../domain/entities/risk-category.js";

interface CategoryScore {
  category: RiskCategory;
  strongCount: number;
  weakCount: number;
}

function scoreCategory(text: string, category: RiskCategory): CategoryScore {
  const lowerText = text.toLowerCase();
  let strongCount = 0;
  let weakCount = 0;

  for (const keyword of category.keywords) {
    const lowerKeyword = keyword.toLowerCase();
    const words = lowerKeyword.split(/\s+/);
    if (words.length > 1) {
      // Multi-word: strong if phrase matches
      if (lowerText.includes(lowerKeyword)) {
        strongCount++;
      } else if (words.every((w) => lowerText.includes(w))) {
        strongCount++;
      }
    } else {
      // Single word
      if (new RegExp(`\\b${lowerKeyword}\\b`).test(lowerText)) {
        weakCount++;
      }
    }
  }

  return { category, strongCount, weakCount };
}

export function classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null {
  if (!text || categories.length === 0) return null;

  const scores = categories
    .map((c) => scoreCategory(text, c))
    .sort((a, b) => {
      if (b.strongCount !== a.strongCount) return b.strongCount - a.strongCount;
      return b.weakCount - a.weakCount;
    });

  const best = scores[0];
  if (!best || best.strongCount < 1) return null;

  const confidence = best.strongCount >= 2 ? "high" : "medium";

  return {
    riskClassification: best.category.name,
    confidence,
    matchedCategory: { name: best.category.name, level: best.category.level },
    relevantArticles: best.category.relevantArticles,
    roleDetermination: "unknown",
    obligationsSummary: best.category.description,
    matchedSignals: [],
    missingSignals: [],
    nextQuestions: [],
    basis: "text",
  };
}
