import { describe, it, expect } from "vitest";
import { classifyBySignals } from "../signals.js";

describe("classifyBySignals", () => {
  describe("out-of-scope", () => {
    it('entity_type "not-applicable" → out-of-scope, Article 2', () => {
      const result = classifyBySignals({ entity_type: "not-applicable" });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("out-of-scope");
      expect(result!.confidence).toBe("high");
      expect(result!.relevantArticles).toContain("Article 2");
      expect(result!.roleDetermination).toBe("unknown");
    });
  });

  describe("CTPP designation", () => {
    it("is_ctpp_designated + ict-third-party → ctpp, Articles 31 & 35", () => {
      const result = classifyBySignals({
        is_ctpp_designated: true,
        entity_type: "ict-third-party",
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("ctpp");
      expect(result!.confidence).toBe("high");
      expect(result!.relevantArticles).toContain("Article 31");
      expect(result!.relevantArticles).toContain("Article 35");
      expect(result!.roleDetermination).toBe("provider");
      expect(result).toMatchSnapshot();
    });

    it("CTPP designation takes precedence over microenterprise flag", () => {
      const result = classifyBySignals({
        is_ctpp_designated: true,
        entity_type: "ict-third-party",
        is_microenterprise: true,
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("ctpp");
    });
  });

  describe("simplified framework (microenterprise)", () => {
    it("credit-institution + microenterprise → simplified-framework, Article 16", () => {
      const result = classifyBySignals({
        entity_type: "credit-institution",
        is_microenterprise: true,
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("simplified-framework");
      expect(result!.relevantArticles).toContain("Article 16");
      expect(result).toMatchSnapshot();
    });

    it("microenterprise + ict-third-party → skips simplified (ICT providers don't get Art. 16)", () => {
      const result = classifyBySignals({
        entity_type: "ict-third-party",
        is_microenterprise: true,
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).not.toBe("simplified-framework");
      expect(result!.riskClassification).toBe("full-framework");
    });
  });

  describe("full framework", () => {
    it("credit-institution + is_microenterprise:false → full-framework high confidence", () => {
      const result = classifyBySignals({
        entity_type: "credit-institution",
        is_microenterprise: false,
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("full-framework");
      expect(result!.confidence).toBe("high");
      expect(result).toMatchSnapshot();
    });

    it("payment-institution (is_microenterprise unset) → full-framework", () => {
      const result = classifyBySignals({ entity_type: "payment-institution" });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("full-framework");
    });

    it("ict-third-party without ctpp designation → full-framework, medium confidence, provider", () => {
      const result = classifyBySignals({ entity_type: "ict-third-party" });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("full-framework");
      expect(result!.confidence).toBe("medium");
      expect(result!.roleDetermination).toBe("provider");
    });

    const entityTypes = [
      "credit-institution",
      "payment-institution",
      "investment-firm",
      "crypto-asset-provider",
      "insurance-undertaking",
      "reinsurance-undertaking",
      "aifm",
      "ucits-manager",
      "csd",
      "ccp",
      "trading-venue",
      "trade-repository",
      "data-reporting-service",
      "credit-rating-agency",
      "ict-intra-group",
    ];

    for (const entityType of entityTypes) {
      it(`entity_type "${entityType}" → full-framework`, () => {
        const result = classifyBySignals({ entity_type: entityType });
        expect(result).not.toBeNull();
        expect(result!.riskClassification).toBe("full-framework");
      });
    }
  });

  describe("edge cases", () => {
    it("empty signals object → returns null", () => {
      const result = classifyBySignals({});
      expect(result).toBeNull();
    });

    it("matchedSignals populated correctly for true booleans and enum values", () => {
      const result = classifyBySignals({
        entity_type: "credit-institution",
        is_microenterprise: true,
      });
      expect(result).not.toBeNull();
      expect(result!.matchedSignals).toContain("entity_type");
      expect(result!.matchedSignals).toContain("is_microenterprise");
    });

    it("matchedSignals excludes false booleans", () => {
      const result = classifyBySignals({
        entity_type: "credit-institution",
        is_microenterprise: false,
      });
      expect(result).not.toBeNull();
      expect(result!.matchedSignals).toContain("entity_type");
      expect(result!.matchedSignals).not.toContain("is_microenterprise");
    });
  });
});
