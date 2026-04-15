import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestApp, teardown, isDatabaseAvailable } from "./setup.js";

describe.skipIf(!isDatabaseAvailable())("E2E API Tests", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardown();
  });

  // ── Health ──────────────────────────────────────────────────────────

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  // ── Classification ─────────────────────────────────────────────────

  describe("POST /api/v1/classify", () => {
    it("classifies employment domain as high-risk with Annex III(4)", async () => {
      const res = await request(app)
        .post("/api/v1/classify")
        .send({
          legislationId: "eu-ai-act",
          role: "provider",
          signals: { domain: "employment" },
        });

      expect(res.status).toBe(200);
      expect(res.body.riskClassification).toBe("high");
      expect(JSON.stringify(res.body)).toContain("Annex III");
    });

    it("classifies social scoring as unacceptable", async () => {
      const res = await request(app)
        .post("/api/v1/classify")
        .send({
          legislationId: "eu-ai-act",
          role: "provider",
          signals: { performs_social_scoring: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.riskClassification).toBe("unacceptable");
    });

    it("returns insufficient_information when no useful input is given", async () => {
      const res = await request(app)
        .post("/api/v1/classify")
        .send({
          legislationId: "eu-ai-act",
          role: "unknown",
        });

      expect(res.status).toBe(200);
      expect(res.body.riskClassification).toBe("insufficient_information");
    });
  });

  // ── Obligations ────────────────────────────────────────────────────

  describe("GET /api/v1/obligations", () => {
    it("returns 14 obligations for provider + high-risk", async () => {
      const res = await request(app)
        .get("/api/v1/obligations")
        .query({
          legislationId: "eu-ai-act",
          role: "provider",
          riskLevel: "high-risk",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(14);
    });

    it("returns 8 obligations for deployer + high-risk", async () => {
      const res = await request(app)
        .get("/api/v1/obligations")
        .query({
          legislationId: "eu-ai-act",
          role: "deployer",
          riskLevel: "high-risk",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
    });
  });

  // ── Penalties ──────────────────────────────────────────────────────

  describe("POST /api/v1/penalties/calculate", () => {
    it("calculates fine for prohibited violation", async () => {
      const res = await request(app)
        .post("/api/v1/penalties/calculate")
        .send({
          legislationId: "eu-ai-act",
          violationType: "prohibited",
          annualTurnoverEur: 500_000_000,
        });

      expect(res.status).toBe(200);
      expect(res.body.calculatedFine).toBeGreaterThan(0);
      expect(res.body.maxFineEur).toBeGreaterThan(0);
    });

    it("applies lower fine for SMEs", async () => {
      const baseRes = await request(app)
        .post("/api/v1/penalties/calculate")
        .send({
          legislationId: "eu-ai-act",
          violationType: "prohibited",
          annualTurnoverEur: 500_000_000,
        });

      const smeRes = await request(app)
        .post("/api/v1/penalties/calculate")
        .send({
          legislationId: "eu-ai-act",
          violationType: "prohibited",
          annualTurnoverEur: 500_000_000,
          isSme: true,
        });

      expect(smeRes.status).toBe(200);
      expect(smeRes.body.calculatedFine).toBeLessThanOrEqual(
        baseRes.body.calculatedFine,
      );
      expect(smeRes.body.smeApplied).toBe(true);
    });
  });

  // ── Articles ───────────────────────────────────────────────────────

  describe("GET /api/v1/articles/:number", () => {
    it("returns article 5 with title containing 'Prohibited'", async () => {
      const res = await request(app)
        .get("/api/v1/articles/5")
        .query({ legislationId: "eu-ai-act" });

      expect(res.status).toBe(200);
      expect(res.body.title).toMatch(/Prohibited/i);
    });

    it("returns 404 for non-existent article", async () => {
      const res = await request(app)
        .get("/api/v1/articles/999")
        .query({ legislationId: "eu-ai-act" });

      expect(res.status).toBe(404);
    });
  });

  // ── Deadlines ──────────────────────────────────────────────────────

  describe("GET /api/v1/deadlines", () => {
    it("returns 6 milestones", async () => {
      const res = await request(app)
        .get("/api/v1/deadlines")
        .query({ legislationId: "eu-ai-act" });

      expect(res.status).toBe(200);
      expect(res.body.deadlines).toHaveLength(6);
    });

    it("returns only future dates when onlyUpcoming=true", async () => {
      const res = await request(app)
        .get("/api/v1/deadlines")
        .query({ legislationId: "eu-ai-act", onlyUpcoming: "true" });

      expect(res.status).toBe(200);
      for (const deadline of res.body.deadlines) {
        expect(deadline.isPast).toBe(false);
      }
    });
  });

  // ── Assessments ────────────────────────────────────────────────────

  describe("POST /api/v1/assessments/:id", () => {
    it("art6-exception: profiling makes exception NOT available", async () => {
      const res = await request(app)
        .post("/api/v1/assessments/art6-exception")
        .send({
          legislationId: "eu-ai-act",
          input: {
            involves_profiling: true,
            has_legal_effects: true,
            is_safety_component: false,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.exceptionAvailable).toBe(false);
    });

    it("gpai-systemic-risk: 1e26 flops crosses threshold", async () => {
      const res = await request(app)
        .post("/api/v1/assessments/gpai-systemic-risk")
        .send({
          legislationId: "eu-ai-act",
          input: {
            training_compute_flops: 1e26,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.crossesThreshold).toBe(true);
    });
  });

  // ── Legislations ───────────────────────────────────────────────────

  describe("GET /api/v1/legislations", () => {
    it("returns legislations including eu-ai-act", async () => {
      const res = await request(app).get("/api/v1/legislations");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((l: { id: string }) => l.id);
      expect(ids).toContain("eu-ai-act");
    });
  });

  // ── Search ─────────────────────────────────────────────────────────

  describe("POST /api/v1/knowledge/search", () => {
    it("returns results for a query (mock embeddings)", async () => {
      const res = await request(app)
        .post("/api/v1/knowledge/search")
        .send({
          legislationId: "eu-ai-act",
          query: "high risk AI systems",
          entityType: "article",
          limit: 5,
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // With mock (all-zeros) embeddings, results are returned but similarity may be low
    });
  });
});
