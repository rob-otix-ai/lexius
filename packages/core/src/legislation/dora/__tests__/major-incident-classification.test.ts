import { describe, it, expect } from "vitest";
import { runMajorIncidentClassification } from "../assessments/major-incident-classification.js";

describe("runMajorIncidentClassification", () => {
  describe("clients affected + duration", () => {
    it("50k clients + 120 min duration → major", () => {
      const result = runMajorIncidentClassification({
        clients_affected: 50_000,
        duration_minutes: 120,
      });
      expect(result.result.is_major_incident).toBe(true);
      expect(result).toMatchSnapshot();
    });

    it("5k clients + 120 min → NOT major (clients below 10k threshold)", () => {
      const result = runMajorIncidentClassification({
        clients_affected: 5_000,
        duration_minutes: 120,
      });
      expect(result.result.is_major_incident).toBe(false);
    });
  });

  describe("data loss scale", () => {
    it('data_loss_scale "critical" → major', () => {
      const result = runMajorIncidentClassification({ data_loss_scale: "critical" });
      expect(result.result.is_major_incident).toBe(true);
    });

    it('data_loss_scale "partial" alone → NOT major', () => {
      const result = runMajorIncidentClassification({ data_loss_scale: "partial" });
      expect(result.result.is_major_incident).toBe(false);
    });
  });

  describe("economic impact", () => {
    it("economic_impact 5M → major", () => {
      const result = runMajorIncidentClassification({ economic_impact_eur: 5_000_000 });
      expect(result.result.is_major_incident).toBe(true);
    });

    it("economic_impact 1M alone → NOT major", () => {
      const result = runMajorIncidentClassification({ economic_impact_eur: 1_000_000 });
      expect(result.result.is_major_incident).toBe(false);
    });
  });

  describe("criticality + duration", () => {
    it("criticality_affected + 45 min duration → major", () => {
      const result = runMajorIncidentClassification({
        criticality_affected: true,
        duration_minutes: 45,
      });
      expect(result.result.is_major_incident).toBe(true);
    });

    it("criticality_affected + 15 min duration → NOT major (duration below 30)", () => {
      const result = runMajorIncidentClassification({
        criticality_affected: true,
        duration_minutes: 15,
      });
      expect(result.result.is_major_incident).toBe(false);
    });
  });

  describe("geographical spread", () => {
    it('geographical_spread "multi-ms" → major', () => {
      const result = runMajorIncidentClassification({ geographical_spread: "multi-ms" });
      expect(result.result.is_major_incident).toBe(true);
    });

    it('geographical_spread "eu-wide" → major', () => {
      const result = runMajorIncidentClassification({ geographical_spread: "eu-wide" });
      expect(result.result.is_major_incident).toBe(true);
    });

    it('geographical_spread "single-ms" → NOT major', () => {
      const result = runMajorIncidentClassification({ geographical_spread: "single-ms" });
      expect(result.result.is_major_incident).toBe(false);
    });
  });

  describe("no flags", () => {
    it("empty input → NOT major, reasoning mentions Art. 17 internal logging", () => {
      const result = runMajorIncidentClassification({});
      expect(result.result.is_major_incident).toBe(false);
      const reasoning = result.reasoning + " " + String(result.result.reasoning);
      expect(reasoning).toMatch(/Art\.?\s*17/);
      expect(reasoning.toLowerCase()).toContain("internal logging");
      expect(result).toMatchSnapshot();
    });
  });

  describe("reporting deadlines", () => {
    it("major incident: initial deadline 4h, final deadline 30d", () => {
      const result = runMajorIncidentClassification({
        clients_affected: 50_000,
        duration_minutes: 120,
      });
      expect(result.result.is_major_incident).toBe(true);
      expect(result.result.initial_report_deadline_hours).toBe(4);
      expect(result.result.final_report_deadline_days).toBe(30);
    });

    it("non-major: deadline fields are null", () => {
      const result = runMajorIncidentClassification({});
      expect(result.result.is_major_incident).toBe(false);
      expect(result.result.initial_report_deadline_hours).toBeNull();
      expect(result.result.final_report_deadline_days).toBeNull();
    });
  });
});
