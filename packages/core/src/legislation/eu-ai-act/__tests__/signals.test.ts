import { describe, it, expect } from "vitest";
import { classifyBySignals } from "../signals.js";

describe("classifyBySignals", () => {
  describe("prohibited (unacceptable) classifications", () => {
    it("social scoring → unacceptable Art. 5(1)(c)", () => {
      const result = classifyBySignals({ performs_social_scoring: true });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("unacceptable");
      expect(result!.relevantArticles).toContain("Article 5(1)(c)");
      expect(result!.matchedCategory!.name).toBe("Social scoring by public authorities");
      expect(result!.matchedCategory!.level).toBe(5);
      expect(result!.basis).toBe("signals");
    });

    it("emotion recognition in workplace/school → unacceptable Art. 5(1)(f)", () => {
      const result = classifyBySignals({
        performs_emotion_recognition_workplace_or_school: true,
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("unacceptable");
      expect(result!.relevantArticles).toContain("Article 5(1)(f)");
      expect(result!.matchedCategory!.name).toBe("Emotion recognition in workplace/school");
    });

    it("biometric law enforcement → unacceptable Art. 5(1)(d)", () => {
      const result = classifyBySignals({ biometric_law_enforcement: true });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("unacceptable");
      expect(result!.relevantArticles).toContain("Article 5(1)(d)");
    });

    it("prohibited checks take precedence over domain mapping", () => {
      const result = classifyBySignals({
        performs_social_scoring: true,
        domain: "employment",
      });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("unacceptable");
      expect(result!.relevantArticles).toContain("Article 5(1)(c)");
    });
  });

  describe("high-risk via domain mapping (Annex III)", () => {
    const domainExpectations: Array<{ domain: string; annexNum: number }> = [
      { domain: "biometrics", annexNum: 1 },
      { domain: "critical-infrastructure", annexNum: 2 },
      { domain: "education", annexNum: 3 },
      { domain: "employment", annexNum: 4 },
      { domain: "essential-services", annexNum: 5 },
      { domain: "law-enforcement", annexNum: 6 },
      { domain: "migration", annexNum: 7 },
      { domain: "justice", annexNum: 8 },
    ];

    for (const { domain, annexNum } of domainExpectations) {
      it(`domain "${domain}" → high-risk Annex III(${annexNum})`, () => {
        const result = classifyBySignals({ domain });
        expect(result).not.toBeNull();
        expect(result!.riskClassification).toBe("high");
        expect(result!.confidence).toBe("high");
        expect(result!.matchedCategory!.name).toContain(`Annex III, ${annexNum}`);
        expect(result!.matchedCategory!.level).toBe(4);
        expect(result!.relevantArticles).toContain("Article 6(2)");
        expect(result!.relevantArticles).toContain("Annex III");
      });
    }

    it('domain "other" → returns null (no match)', () => {
      const result = classifyBySignals({ domain: "other" });
      expect(result).toBeNull();
    });
  });

  describe("high-risk via safety component", () => {
    it("is_safety_component true → high-risk", () => {
      const result = classifyBySignals({ is_safety_component: true });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("high");
      expect(result!.matchedCategory!.name).toBe("Safety component (Annex I)");
      expect(result!.relevantArticles).toContain("Article 6(1)");
    });
  });

  describe("limited-risk classifications", () => {
    it("generates_synthetic_content → limited", () => {
      const result = classifyBySignals({ generates_synthetic_content: true });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("limited");
      expect(result!.confidence).toBe("high");
      expect(result!.relevantArticles).toContain("Article 50(2)");
    });

    it("interacts_with_natural_persons → limited", () => {
      const result = classifyBySignals({ interacts_with_natural_persons: true });
      expect(result).not.toBeNull();
      expect(result!.riskClassification).toBe("limited");
      expect(result!.confidence).toBe("medium");
      expect(result!.relevantArticles).toContain("Article 50(1)");
      expect(result!.roleDetermination).toBe("deployer");
    });
  });

  describe("edge cases", () => {
    it("empty signals object → returns null", () => {
      const result = classifyBySignals({});
      expect(result).toBeNull();
    });

    it("matchedSignals array populated correctly for true boolean signals", () => {
      const result = classifyBySignals({ performs_social_scoring: true, domain: "employment" });
      expect(result).not.toBeNull();
      expect(result!.matchedSignals).toContain("performs_social_scoring");
      expect(result!.matchedSignals).toContain("domain");
    });

    it('matchedSignals excludes "other" domain and false booleans', () => {
      const result = classifyBySignals({
        domain: "other",
        is_safety_component: false,
        generates_synthetic_content: true,
      });
      expect(result).not.toBeNull();
      expect(result!.matchedSignals).not.toContain("domain");
      expect(result!.matchedSignals).not.toContain("is_safety_component");
      expect(result!.matchedSignals).toContain("generates_synthetic_content");
    });

    it("missingSignals includes keys not provided", () => {
      const result = classifyBySignals({ performs_social_scoring: true });
      expect(result).not.toBeNull();
      expect(result!.missingSignals).toContain("domain");
      expect(result!.missingSignals).toContain("is_safety_component");
      expect(result!.missingSignals).toContain("generates_synthetic_content");
      expect(result!.missingSignals).not.toContain("performs_social_scoring");
    });
  });
});
