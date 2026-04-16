import { describe, it, expect } from "vitest";
import { runCriticalFunctionAssessment } from "../assessments/critical-function-assessment.js";

describe("runCriticalFunctionAssessment", () => {
  describe("payment processing / settlement / customer data flags", () => {
    it("supports_payment_processing → CIF, contractual requirements apply", () => {
      const result = runCriticalFunctionAssessment({ supports_payment_processing: true });
      expect(result.result.is_critical_function).toBe(true);
      expect(result.result.contractual_requirements_apply).toBe(true);
      expect(result).toMatchSnapshot();
    });

    it("supports_settlement → CIF", () => {
      const result = runCriticalFunctionAssessment({ supports_settlement: true });
      expect(result.result.is_critical_function).toBe(true);
    });

    it("supports_customer_data → CIF", () => {
      const result = runCriticalFunctionAssessment({ supports_customer_data: true });
      expect(result.result.is_critical_function).toBe(true);
    });
  });

  describe("tolerable downtime thresholds", () => {
    it("tolerable_downtime_minutes = 30 → CIF (below 60)", () => {
      const result = runCriticalFunctionAssessment({ tolerable_downtime_minutes: 30 });
      expect(result.result.is_critical_function).toBe(true);
    });

    it("tolerable_downtime_minutes = 120 → not CIF", () => {
      const result = runCriticalFunctionAssessment({ tolerable_downtime_minutes: 120 });
      expect(result.result.is_critical_function).toBe(false);
    });
  });

  describe("criticality rating", () => {
    it('criticality_rating "high" → CIF', () => {
      const result = runCriticalFunctionAssessment({ criticality_rating: "high" });
      expect(result.result.is_critical_function).toBe(true);
    });

    it('criticality_rating "critical" → CIF', () => {
      const result = runCriticalFunctionAssessment({ criticality_rating: "critical" });
      expect(result.result.is_critical_function).toBe(true);
    });

    it('criticality_rating "low" → not CIF', () => {
      const result = runCriticalFunctionAssessment({ criticality_rating: "low" });
      expect(result.result.is_critical_function).toBe(false);
    });
  });

  describe("no flags", () => {
    it("empty input → not CIF, reasoning mentions standard ICT third-party controls", () => {
      const result = runCriticalFunctionAssessment({});
      expect(result.result.is_critical_function).toBe(false);
      expect(result.reasoning).toContain("Standard ICT third-party controls");
      expect(result).toMatchSnapshot();
    });
  });

  describe("multiple flags combine", () => {
    it("multiple flags list all reasons in reasoning", () => {
      const result = runCriticalFunctionAssessment({
        supports_payment_processing: true,
        supports_settlement: true,
        supports_customer_data: true,
      });
      expect(result.result.is_critical_function).toBe(true);
      const reasoning = result.reasoning + " " + String(result.result.reasoning);
      expect(reasoning.toLowerCase()).toContain("payment");
      expect(reasoning.toLowerCase()).toContain("settlement");
      expect(reasoning.toLowerCase()).toContain("customer data");
    });
  });

  describe("metadata", () => {
    it('assessmentId is "critical-function-assessment"', () => {
      const result = runCriticalFunctionAssessment({ supports_payment_processing: true });
      expect(result.assessmentId).toBe("critical-function-assessment");
    });

    it("relevantArticles includes Article 28 and Article 30", () => {
      const result = runCriticalFunctionAssessment({ supports_payment_processing: true });
      expect(result.relevantArticles).toContain("Article 28");
      expect(result.relevantArticles).toContain("Article 30");
    });
  });
});
