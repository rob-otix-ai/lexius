import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("GET /api/v1/deadlines", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with all deadlines", async () => {
    const deadlinesResult = {
      deadlines: [
        { date: "2025-02-02", description: "Prohibitions apply", isPast: true },
        { date: "2025-08-02", description: "GPAI rules apply", isPast: false },
      ],
      nextMilestone: { date: "2025-08-02", description: "GPAI rules apply" },
    };
    container.getDeadlines.execute.mockResolvedValue(deadlinesResult);

    const res = await request(app)
      .get("/api/v1/deadlines")
      .query({ legislationId: "eu-ai-act" });

    expect(res.status).toBe(200);
    expect(res.body.deadlines).toHaveLength(2);
    expect(container.getDeadlines.execute).toHaveBeenCalledWith("eu-ai-act");
  });

  it("returns only upcoming deadlines when onlyUpcoming=true", async () => {
    const deadlinesResult = {
      deadlines: [
        { date: "2025-02-02", description: "Prohibitions apply", isPast: true },
        { date: "2025-08-02", description: "GPAI rules apply", isPast: false },
        { date: "2026-08-02", description: "Full application", isPast: false },
      ],
      nextMilestone: { date: "2025-08-02", description: "GPAI rules apply" },
    };
    container.getDeadlines.execute.mockResolvedValue(deadlinesResult);

    const res = await request(app)
      .get("/api/v1/deadlines")
      .query({ legislationId: "eu-ai-act", onlyUpcoming: "true" });

    expect(res.status).toBe(200);
    expect(res.body.deadlines).toHaveLength(2);
    expect(res.body.deadlines.every((d: any) => !d.isPast)).toBe(true);
    expect(res.body.nextMilestone).toBeDefined();
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app).get("/api/v1/deadlines");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
