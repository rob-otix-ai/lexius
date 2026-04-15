import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("POST /api/v1/classify", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with valid body", async () => {
    const classificationResult = {
      riskClassification: "high-risk",
      confidence: 0.92,
      obligations: [],
    };
    container.classifySystem.execute.mockResolvedValue(classificationResult);

    const res = await request(app)
      .post("/api/v1/classify")
      .send({
        legislationId: "eu-ai-act",
        role: "provider",
        description: "A facial recognition system",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(classificationResult);
    expect(container.classifySystem.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      role: "provider",
      description: "A facial recognition system",
    });
  });

  it("passes optional fields correctly", async () => {
    container.classifySystem.execute.mockResolvedValue({ riskClassification: "minimal" });

    const res = await request(app)
      .post("/api/v1/classify")
      .send({
        legislationId: "eu-ai-act",
        role: "deployer",
        useCase: "chatbot",
        signals: { biometric: true },
      });

    expect(res.status).toBe(200);
    expect(container.classifySystem.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      role: "deployer",
      useCase: "chatbot",
      signals: { biometric: true },
    });
  });

  it("returns 400 with invalid role", async () => {
    const res = await request(app)
      .post("/api/v1/classify")
      .send({
        legislationId: "eu-ai-act",
        role: "invalid-role",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/classify")
      .send({ role: "provider" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns the classification result as JSON", async () => {
    const result = {
      riskClassification: "unacceptable",
      confidence: 0.99,
      matchedCategories: ["social-scoring"],
    };
    container.classifySystem.execute.mockResolvedValue(result);

    const res = await request(app)
      .post("/api/v1/classify")
      .send({ legislationId: "eu-ai-act", role: "provider" });

    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual(result);
  });
});
