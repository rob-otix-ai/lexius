import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("POST /api/v1/knowledge/search", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with valid search body", async () => {
    const searchResult = {
      results: [
        { id: "art-5", title: "Prohibited practices", score: 0.95 },
      ],
    };
    container.searchKnowledge.execute.mockResolvedValue(searchResult);

    const res = await request(app)
      .post("/api/v1/knowledge/search")
      .send({
        legislationId: "eu-ai-act",
        query: "prohibited AI practices",
        entityType: "article",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(searchResult);
    expect(container.searchKnowledge.execute).toHaveBeenCalledWith({
      legislationId: "eu-ai-act",
      query: "prohibited AI practices",
      limit: 10,
      entityType: "article",
    });
  });

  it("returns 400 when query is missing", async () => {
    const res = await request(app)
      .post("/api/v1/knowledge/search")
      .send({
        legislationId: "eu-ai-act",
        entityType: "article",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 with invalid entityType", async () => {
    const res = await request(app)
      .post("/api/v1/knowledge/search")
      .send({
        legislationId: "eu-ai-act",
        query: "biometric",
        entityType: "invalid-type",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toBeDefined();
  });

  it("uses custom limit when provided", async () => {
    container.searchKnowledge.execute.mockResolvedValue({ results: [] });

    const res = await request(app)
      .post("/api/v1/knowledge/search")
      .send({
        legislationId: "eu-ai-act",
        query: "transparency",
        entityType: "obligation",
        limit: 25,
      });

    expect(res.status).toBe(200);
    expect(container.searchKnowledge.execute).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("returns 400 when legislationId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/knowledge/search")
      .send({
        query: "biometric",
        entityType: "article",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
