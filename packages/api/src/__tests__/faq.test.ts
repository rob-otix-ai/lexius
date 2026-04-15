import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("POST /api/v1/faq/search", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with valid question", async () => {
    const faqResult = {
      answer: "The EU AI Act applies to...",
      sources: [{ id: "faq-1", question: "What is the EU AI Act?" }],
    };
    container.answerQuestion.execute.mockResolvedValue(faqResult);

    const res = await request(app)
      .post("/api/v1/faq/search")
      .send({
        legislationId: "eu-ai-act",
        question: "What is the EU AI Act?",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(faqResult);
    expect(container.answerQuestion.execute).toHaveBeenCalledWith(
      "eu-ai-act",
      "What is the EU AI Act?",
    );
  });

  it("returns 400 when question is missing", async () => {
    const res = await request(app)
      .post("/api/v1/faq/search")
      .send({
        legislationId: "eu-ai-act",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/faq/search")
      .send({
        question: "What is the EU AI Act?",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
