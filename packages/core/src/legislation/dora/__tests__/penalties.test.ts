import { describe, it, expect } from "vitest";
import { calculatePenalty } from "../penalties.js";
import type { Penalty } from "../../../domain/entities/penalty.js";
import type { Provenance } from "../../../domain/value-objects/provenance.js";

const TEST_PROVENANCE: Provenance = {
  tier: "CURATED",
  curatedBy: "test",
  reviewedAt: new Date("2026-01-01"),
};

function makeTier(overrides: Partial<Penalty> = {}): Penalty {
  return {
    id: "dora-pen-1",
    legislationId: "dora",
    violationType: "general-non-compliance",
    name: "General DORA non-compliance",
    maxFineEur: 2_000_000,
    globalTurnoverPercentage: 2,
    article: "Article 50",
    description: "Administrative penalties for financial entity non-compliance",
    applicableTo: ["financial-entity"],
    smeRules: null,
    provenance: TEST_PROVENANCE,
    derivedFrom: [],
    extractExempt: false,
    extractExemptReason: null,
    ...overrides,
  };
}

function makeCtppTier(overrides: Partial<Penalty> = {}): Penalty {
  return makeTier({
    id: "dora-pen-ctpp",
    violationType: "ctpp-non-compliance",
    name: "CTPP periodic penalty payments",
    maxFineEur: 5_000_000,
    globalTurnoverPercentage: 1,
    article: "Article 35",
    description: "Periodic penalty payments for CTPP non-compliance",
    applicableTo: ["ctpp"],
    ...overrides,
  });
}

describe("calculatePenalty (DORA)", () => {
  describe("standard tier (non-SME)", () => {
    it("turnover 100M: max(2M, 2% of 100M = 2M) = 2M", () => {
      const result = calculatePenalty(makeTier(), 100_000_000, false);
      expect(result.calculatedFine).toBe(2_000_000);
      expect(result.smeApplied).toBe(false);
    });

    it("turnover 1B: max(2M, 2% of 1B = 20M) = 20M", () => {
      const result = calculatePenalty(makeTier(), 1_000_000_000, false);
      expect(result.calculatedFine).toBe(20_000_000);
      expect(result.smeApplied).toBe(false);
    });

    it("snapshot standard case", () => {
      const result = calculatePenalty(makeTier(), 1_000_000_000, false);
      expect(result).toMatchSnapshot();
    });
  });

  describe("SME provision", () => {
    it("SME turnover 10M: min(2M, 2% of 10M = 200K) = 200K", () => {
      const result = calculatePenalty(makeTier(), 10_000_000, true);
      expect(result.calculatedFine).toBeCloseTo(200_000, 0);
      expect(result.smeApplied).toBe(true);
    });

    it("SME explanation mentions proportionality and Art. 51", () => {
      const result = calculatePenalty(makeTier(), 10_000_000, true);
      expect(result.smeApplied).toBe(true);
      expect(result.explanation.toLowerCase()).toContain("proportionality");
      expect(result.explanation).toContain("Art. 51");
    });

    it("snapshot SME case", () => {
      const result = calculatePenalty(makeTier(), 10_000_000, true);
      expect(result).toMatchSnapshot();
    });
  });

  describe("CTPP tier", () => {
    it("CTPP tier (€1B turnover, 180-day cap): fine bounded by 1% daily × 180", () => {
      const turnover = 1_000_000_000;
      const result = calculatePenalty(makeCtppTier(), turnover, false);
      const dailyTurnover = turnover / 365;
      const maxDailyPenalty = dailyTurnover * 0.01;
      const expectedCap = maxDailyPenalty * 180;
      expect(result.calculatedFine).toBeCloseTo(expectedCap, 0);
      expect(result.calculatedFine).toBeLessThanOrEqual(expectedCap + 1);
    });

    it("CTPP explanation mentions periodic penalty payments and Art. 35", () => {
      const result = calculatePenalty(makeCtppTier(), 1_000_000_000, false);
      expect(result.explanation).toContain("periodic penalty payments");
      expect(result.explanation).toContain("Art. 35");
    });

    it("CTPP smeApplied is false even if isSme is true", () => {
      const result = calculatePenalty(makeCtppTier(), 1_000_000_000, true);
      expect(result.smeApplied).toBe(false);
    });

    it("snapshot CTPP case", () => {
      const result = calculatePenalty(makeCtppTier(), 1_000_000_000, false);
      expect(result).toMatchSnapshot();
    });
  });

  describe("zero turnover", () => {
    it("non-SME: fine = maxFineEur", () => {
      const result = calculatePenalty(makeTier(), 0, false);
      expect(result.calculatedFine).toBe(2_000_000);
    });

    it("SME: fine = 0", () => {
      const result = calculatePenalty(makeTier(), 0, true);
      expect(result.calculatedFine).toBe(0);
    });
  });

  describe("floating-point handling", () => {
    it("computes percentages with floating-point precision", () => {
      const result = calculatePenalty(makeTier(), 123_456_789, false);
      expect(result.calculatedFine).toBeCloseTo(
        Math.max(2_000_000, 0.02 * 123_456_789),
        0,
      );
    });
  });
});
