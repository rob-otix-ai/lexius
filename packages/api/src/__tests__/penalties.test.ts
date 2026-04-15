import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("POST /api/v1/penalties/calculate", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with valid body", async () => {
    const penaltyResult = {
      maxFineEur: 35_000_000,
      maxFinePercentTurnover: 7,
      applicableFine: 35_000_000,
    };
    container.calculatePenalty.execute.mockResolvedValue(penaltyResult);

    const res = await request(app)
      .post("/api/v1/penalties/calculate")
      .send({
        legislationId: "eu-ai-act",
        violationType: "prohibited-practice",
        annualTurnoverEur: 500_000_000,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(penaltyResult);
    expect(container.calculatePenalty.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      violationType: "prohibited-practice",
      annualTurnoverEur: 500_000_000,
    });
  });

  it("returns 400 when violationType is missing", async () => {
    const res = await request(app)
      .post("/api/v1/penalties/calculate")
      .send({
        legislationId: "eu-ai-act",
        annualTurnoverEur: 500_000_000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 when annualTurnoverEur is missing", async () => {
    const res = await request(app)
      .post("/api/v1/penalties/calculate")
      .send({
        legislationId: "eu-ai-act",
        violationType: "prohibited-practice",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/penalties/calculate")
      .send({
        violationType: "prohibited-practice",
        annualTurnoverEur: 500_000_000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("passes isSme optional field", async () => {
    container.calculatePenalty.execute.mockResolvedValue({ applicableFine: 1_000_000 });

    const res = await request(app)
      .post("/api/v1/penalties/calculate")
      .send({
        legislationId: "eu-ai-act",
        violationType: "non-compliance",
        annualTurnoverEur: 10_000_000,
        isSme: true,
      });

    expect(res.status).toBe(200);
    expect(container.calculatePenalty.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      violationType: "non-compliance",
      annualTurnoverEur: 10_000_000,
      isSme: true,
    });
  });
});
