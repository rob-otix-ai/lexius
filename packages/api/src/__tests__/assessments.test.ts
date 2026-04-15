import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("POST /api/v1/assessments/:id", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with valid assessment body", async () => {
    const assessmentResult = {
      eligible: true,
      reasoning: "Meets criteria for Art 6 exception",
    };
    container.runAssessment.execute.mockReturnValue(assessmentResult);

    const res = await request(app)
      .post("/api/v1/assessments/art6-exception")
      .send({
        legislationId: "eu-ai-act",
        input: { systemType: "medical-device", riskLevel: "high" },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(assessmentResult);
    expect(container.runAssessment.execute).toHaveBeenCalledWith(
      "eu-ai-act",
      "art6-exception",
      { systemType: "medical-device", riskLevel: "high" },
    );
  });

  it("returns 400 when input is missing", async () => {
    const res = await request(app)
      .post("/api/v1/assessments/art6-exception")
      .send({
        legislationId: "eu-ai-act",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/assessments/art6-exception")
      .send({
        input: { systemType: "medical-device" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
