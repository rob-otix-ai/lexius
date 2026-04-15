import { describe, it, expect } from "vitest";
import { runGpaiSystemicRisk } from "../assessments/gpai-systemic-risk.js";

describe("runGpaiSystemicRisk", () => {
  describe("threshold-based classification", () => {
    it("training_flops = 1e25 → crosses threshold (systemic)", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e25,
        commission_designated: false,
      });
      expect(result).toMatchSnapshot();
    });

    it("training_flops = 9.9e24 → does not cross threshold", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 9.9e24,
        commission_designated: false,
      });
      expect(result.result.systemic).toBe(false);
      expect(result.result.crosses_threshold).toBe(false);
    });

    it("training_flops = 1e26 → crosses threshold", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e26,
        commission_designated: false,
      });
      expect(result.result.systemic).toBe(true);
      expect(result.result.crosses_threshold).toBe(true);
    });
  });

  describe("commission designation", () => {
    it("commission_designated = true with low flops → still systemic", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e20,
        commission_designated: true,
        model_name: "DesignatedModel",
      });
      expect(result).toMatchSnapshot();
    });

    it("both false → not systemic", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e20,
        commission_designated: false,
      });
      expect(result.result.systemic).toBe(false);
    });
  });

  describe("obligations in output", () => {
    it("systemic model gets both baseline and systemic obligations", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e25,
        commission_designated: false,
      });
      expect(result.result.baseline_obligations).toBeInstanceOf(Array);
      expect((result.result.baseline_obligations as string[]).length).toBeGreaterThan(0);
      expect(result.result.systemic_obligations).toBeInstanceOf(Array);
      expect((result.result.systemic_obligations as string[]).length).toBeGreaterThan(0);
      expect(result.relevantArticles).toContain("Article 55");
    });

    it("non-systemic model gets only baseline obligations", () => {
      const result = runGpaiSystemicRisk({
        training_flops: 1e20,
        commission_designated: false,
      });
      expect((result.result.baseline_obligations as string[]).length).toBeGreaterThan(0);
      expect((result.result.systemic_obligations as string[]).length).toBe(0);
      expect(result.relevantArticles).not.toContain("Article 55");
    });
  });

  describe("input validation", () => {
    it("negative training_flops → throws error", () => {
      expect(() =>
        runGpaiSystemicRisk({ training_flops: -1, commission_designated: false }),
      ).toThrow("training_flops must be a non-negative number");
    });

    it("non-number training_flops → throws error", () => {
      expect(() =>
        runGpaiSystemicRisk({ training_flops: "big" as unknown, commission_designated: false }),
      ).toThrow("training_flops must be a non-negative number");
    });

    it("missing commission_designated → throws error", () => {
      expect(() =>
        runGpaiSystemicRisk({ training_flops: 1e20 }),
      ).toThrow("commission_designated must be a boolean");
    });
  });
});
