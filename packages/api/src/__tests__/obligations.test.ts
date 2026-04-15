import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("GET /api/v1/obligations", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with legislationId query param", async () => {
    const obligations = [
      { id: "ob-1", title: "Risk management system", role: "provider" },
      { id: "ob-2", title: "Data governance", role: "provider" },
    ];
    container.getObligations.execute.mockResolvedValue(obligations);

    const res = await request(app)
      .get("/api/v1/obligations")
      .query({ legislationId: "eu-ai-act" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(obligations);
    expect(container.getObligations.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
    });
  });

  it("passes all filter params to use case", async () => {
    container.getObligations.execute.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/obligations")
      .query({
        legislationId: "eu-ai-act",
        role: "provider",
        riskLevel: "high-risk",
        category: "transparency",
      });

    expect(res.status).toBe(200);
    expect(container.getObligations.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      role: "provider",
      riskLevel: "high-risk",
      category: "transparency",
    });
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .get("/api/v1/obligations");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns array of obligations", async () => {
    const obligations = [{ id: "ob-1", title: "Obligation 1" }];
    container.getObligations.execute.mockResolvedValue(obligations);

    const res = await request(app)
      .get("/api/v1/obligations")
      .query({ legislationId: "eu-ai-act" });

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});
