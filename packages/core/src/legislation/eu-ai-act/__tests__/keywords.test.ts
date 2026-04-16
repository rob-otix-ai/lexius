import { describe, it, expect } from "vitest";
import { classifyByKeywords } from "../keywords.js";
import type { RiskCategory } from "../../../domain/entities/risk-category.js";
import type { Provenance } from "../../../domain/value-objects/provenance.js";

const TEST_PROVENANCE: Provenance = {
  tier: "CURATED",
  curatedBy: "test",
  reviewedAt: new Date("2026-01-01"),
};

function makeCategory(overrides: Partial<RiskCategory> = {}): RiskCategory {
  return {
    id: "cat-1",
    legislationId: "eu-ai-act",
    name: "Biometric identification",
    level: 4,
    description: "Biometric systems",
    keywords: ["facial recognition", "biometric", "fingerprint"],
    examples: [],
    relevantArticles: ["Article 6(2)"],
    provenance: TEST_PROVENANCE,
    ...overrides,
  };
}

describe("classifyByKeywords", () => {
  it("matches text containing multi-word keyword phrase", () => {
    const categories = [makeCategory()];
    const result = classifyByKeywords(
      "Our system uses facial recognition and biometric data",
      categories,
    );
    expect(result).not.toBeNull();
    expect(result!.riskClassification).toBe("Biometric identification");
    expect(result!.matchedCategory!.name).toBe("Biometric identification");
    expect(result!.matchedCategory!.level).toBe(4);
    expect(result!.basis).toBe("text");
  });

  it("returns null when text has no matching keywords", () => {
    const categories = [makeCategory()];
    const result = classifyByKeywords("This is about gardening tools", categories);
    expect(result).toBeNull();
  });

  it("returns null for empty text", () => {
    const categories = [makeCategory()];
    const result = classifyByKeywords("", categories);
    expect(result).toBeNull();
  });

  it("returns null for empty categories array", () => {
    const result = classifyByKeywords("facial recognition biometric", []);
    expect(result).toBeNull();
  });

  it("performs case insensitive matching", () => {
    const categories = [makeCategory()];
    const result = classifyByKeywords("FACIAL RECOGNITION system", categories);
    expect(result).not.toBeNull();
    expect(result!.riskClassification).toBe("Biometric identification");
  });

  it("strong match (multi-word phrase) counts more than weak match (single word)", () => {
    const catWithPhrases = makeCategory({
      id: "cat-phrases",
      name: "Category A",
      keywords: ["facial recognition", "biometric identification"],
    });
    const catWithWords = makeCategory({
      id: "cat-words",
      name: "Category B",
      keywords: ["camera", "sensor", "device", "system", "input"],
    });

    const result = classifyByKeywords(
      "A facial recognition and biometric identification camera sensor device system input",
      [catWithWords, catWithPhrases],
    );

    expect(result).not.toBeNull();
    expect(result!.riskClassification).toBe("Category A");
  });

  it("highest scoring category wins", () => {
    const catA = makeCategory({
      id: "cat-a",
      name: "Employment AI",
      level: 4,
      keywords: ["hiring process", "employment screening"],
      relevantArticles: ["Article 6(2)"],
    });
    const catB = makeCategory({
      id: "cat-b",
      name: "Education AI",
      level: 4,
      keywords: ["student assessment", "educational evaluation", "grading system"],
      relevantArticles: ["Article 6(2)"],
    });

    const text = "This system does student assessment and educational evaluation and grading system analysis";
    const result = classifyByKeywords(text, [catA, catB]);
    expect(result).not.toBeNull();
    expect(result!.riskClassification).toBe("Education AI");
  });

  it("confidence is high when two or more strong matches", () => {
    const categories = [makeCategory({ keywords: ["facial recognition", "biometric identification", "iris scan"] })];
    const result = classifyByKeywords(
      "Uses facial recognition and biometric identification technology",
      categories,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
  });

  it("confidence is medium with only one strong match", () => {
    const categories = [makeCategory({ keywords: ["facial recognition", "camera"] })];
    const result = classifyByKeywords("Uses facial recognition camera", categories);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("medium");
  });

  it("returns null when only single-word (weak) matches exist", () => {
    const categories = [makeCategory({ keywords: ["biometric", "camera", "sensor"] })];
    const result = classifyByKeywords("This uses a biometric camera sensor", categories);
    expect(result).toBeNull();
  });
});
