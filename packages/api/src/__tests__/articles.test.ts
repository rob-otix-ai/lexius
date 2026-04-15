import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("GET /api/v1/articles/:number", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with article data", async () => {
    const article = {
      number: "5",
      title: "Prohibited AI practices",
      content: "The following AI practices shall be prohibited...",
    };
    container.getArticle.execute.mockResolvedValue(article);

    const res = await request(app)
      .get("/api/v1/articles/5")
      .query({ legislationId: "eu-ai-act" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(article);
    expect(container.getArticle.execute).toHaveBeenCalledWith("eu-ai-act", "5");
  });

  it("returns 404 when article not found", async () => {
    container.getArticle.execute.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/v1/articles/999")
      .query({ legislationId: "eu-ai-act" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Article not found");
  });

  it("returns 400 when legislationId query param is missing", async () => {
    const res = await request(app).get("/api/v1/articles/5");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
