import { describe, it, expect } from "vitest";
import { calculatePenalty } from "../penalties.js";
import type { Penalty } from "../../../domain/entities/penalty.js";

function makeTier(overrides: Partial<Penalty> = {}): Penalty {
  return {
    id: "pen-1",
    legislationId: "eu-ai-act",
    violationType: "prohibited",
    name: "Prohibited AI practices",
    maxFineEur: 35_000_000,
    globalTurnoverPercentage: 7,
    article: "Article 99(3)",
    description: "Fines for prohibited AI practices",
    applicableTo: ["provider", "deployer"],
    smeRules: null,
    ...overrides,
  };
}

describe("calculatePenalty", () => {
  describe("prohibited tier (non-SME)", () => {
    it("turnover 500M: max(35M, 7% of 500M = 35M) = 35M", () => {
      const result = calculatePenalty(makeTier(), 500_000_000, false);
      expect(result.calculatedFine).toBe(35_000_000);
      expect(result.smeApplied).toBe(false);
    });

    it("turnover 100M: max(35M, 7% of 100M = 7M) = 35M", () => {
      const result = calculatePenalty(makeTier(), 100_000_000, false);
      expect(result.calculatedFine).toBe(35_000_000);
    });

    it("turnover 1B: max(35M, 7% of 1B = 70M) = 70M", () => {
      const result = calculatePenalty(makeTier(), 1_000_000_000, false);
      expect(result.calculatedFine).toBe(70_000_000);
    });
  });

  describe("SME provision", () => {
    it("SME turnover 10M: min(35M, 7% of 10M = 700K) = 700K", () => {
      const result = calculatePenalty(makeTier(), 10_000_000, true);
      expect(result.calculatedFine).toBe(700_000);
      expect(result.smeApplied).toBe(true);
    });

    it("SME flag is set correctly in output", () => {
      const result = calculatePenalty(makeTier(), 10_000_000, true);
      expect(result.smeApplied).toBe(true);
      expect(result.explanation).toContain("SME");
      expect(result.explanation).toContain("Art. 99(6)");
    });
  });

  describe("all three tiers with correct amounts", () => {
    it("prohibited tier: maxFine 35M, 7%", () => {
      const tier = makeTier({
        violationType: "prohibited",
        name: "Prohibited AI practices",
        maxFineEur: 35_000_000,
        globalTurnoverPercentage: 7,
      });
      const result = calculatePenalty(tier, 1_000_000_000, false);
      expect(result.tierName).toBe("Prohibited AI practices");
      expect(result.maxFineEur).toBe(35_000_000);
      expect(result.globalTurnoverPercentage).toBe(7);
      expect(result.calculatedFine).toBe(70_000_000);
    });

    it("high_risk tier: maxFine 15M, 3%", () => {
      const tier = makeTier({
        violationType: "high_risk",
        name: "High-risk non-compliance",
        maxFineEur: 15_000_000,
        globalTurnoverPercentage: 3,
      });
      const result = calculatePenalty(tier, 1_000_000_000, false);
      expect(result.tierName).toBe("High-risk non-compliance");
      expect(result.maxFineEur).toBe(15_000_000);
      expect(result.calculatedFine).toBe(30_000_000);
    });

    it("false_info tier: maxFine 7.5M, 1%", () => {
      const tier = makeTier({
        violationType: "false_info",
        name: "False information to authorities",
        maxFineEur: 7_500_000,
        globalTurnoverPercentage: 1,
      });
      const result = calculatePenalty(tier, 1_000_000_000, false);
      expect(result.tierName).toBe("False information to authorities");
      expect(result.maxFineEur).toBe(7_500_000);
      expect(result.calculatedFine).toBe(10_000_000);
    });
  });

  describe("zero turnover", () => {
    it("non-SME: fine = fixed amount (maxFineEur)", () => {
      const result = calculatePenalty(makeTier(), 0, false);
      expect(result.calculatedFine).toBe(35_000_000);
    });

    it("SME: fine = 0 (min of maxFineEur and 0)", () => {
      const result = calculatePenalty(makeTier(), 0, true);
      expect(result.calculatedFine).toBe(0);
    });
  });
});
