import { describe, it, expect } from "vitest";
import { runTlptApplicability } from "../assessments/tlpt-applicability.js";

describe("runTlptApplicability", () => {
  describe("systemically important", () => {
    it("credit-institution + systemically_important → TLPT required", () => {
      const result = runTlptApplicability({
        entity_type: "credit-institution",
        is_systemically_important: true,
      });
      expect(result.result.tlpt_required).toBe(true);
      expect(result).toMatchSnapshot();
    });
  });

  describe("payment / e-money thresholds", () => {
    it("payment-institution with 200B payment volume → required", () => {
      const result = runTlptApplicability({
        entity_type: "payment-institution",
        annual_payment_volume_eur: 200_000_000_000,
      });
      expect(result.result.tlpt_required).toBe(true);
    });

    it("payment-institution with 100B payment volume → NOT required", () => {
      const result = runTlptApplicability({
        entity_type: "payment-institution",
        annual_payment_volume_eur: 100_000_000_000,
      });
      expect(result.result.tlpt_required).toBe(false);
    });

    it("payment-institution with 50B e-money → required", () => {
      const result = runTlptApplicability({
        entity_type: "payment-institution",
        outstanding_emoney_eur: 50_000_000_000,
      });
      expect(result.result.tlpt_required).toBe(true);
    });
  });

  describe("market share thresholds", () => {
    it("CSD with 6% market share → required", () => {
      const result = runTlptApplicability({
        entity_type: "csd",
        market_share_percentage: 6,
      });
      expect(result.result.tlpt_required).toBe(true);
    });

    it("CCP with 10% market share → required", () => {
      const result = runTlptApplicability({
        entity_type: "ccp",
        market_share_percentage: 10,
      });
      expect(result.result.tlpt_required).toBe(true);
    });

    it("trading-venue with 3% market share → NOT required", () => {
      const result = runTlptApplicability({
        entity_type: "trading-venue",
        market_share_percentage: 3,
      });
      expect(result.result.tlpt_required).toBe(false);
    });
  });

  describe("no threshold match", () => {
    it("AIFM → not required", () => {
      const result = runTlptApplicability({ entity_type: "aifm" });
      expect(result.result.tlpt_required).toBe(false);
      expect(result).toMatchSnapshot();
    });
  });

  describe("next TLPT date", () => {
    it("required + last_tlpt_date provided → next = last + 3 years", () => {
      const result = runTlptApplicability({
        entity_type: "credit-institution",
        is_systemically_important: true,
        last_tlpt_date: "2024-01-01",
      });
      expect(result.result.tlpt_required).toBe(true);
      expect(result.result.next_tlpt_date).toBe("2027-01-01");
    });

    it("required + no last_tlpt_date → next_tlpt_date is null", () => {
      const result = runTlptApplicability({
        entity_type: "credit-institution",
        is_systemically_important: true,
      });
      expect(result.result.tlpt_required).toBe(true);
      expect(result.result.next_tlpt_date).toBeNull();
    });
  });

  describe("not required reasoning", () => {
    it("reasoning mentions Art. 24-25 standard testing still applies", () => {
      const result = runTlptApplicability({ entity_type: "aifm" });
      expect(result.result.tlpt_required).toBe(false);
      const reasoning = result.reasoning + " " + String(result.result.reasoning);
      expect(reasoning).toMatch(/Art\.?\s*24/);
      expect(reasoning).toMatch(/25/);
    });
  });

  describe("methodology", () => {
    it("methodology string mentions TIBER-EU", () => {
      const result = runTlptApplicability({
        entity_type: "credit-institution",
        is_systemically_important: true,
      });
      expect(String(result.result.methodology)).toContain("TIBER-EU");
    });
  });
});
