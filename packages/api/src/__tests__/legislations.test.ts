import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup.js";
import type { Express } from "express";

describe("GET /api/v1/legislations", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp());
  });

  it("returns 200 with list of legislations", async () => {
    const legislations = [
      { id: "eu-ai-act", name: "EU AI Act", status: "active" },
      { id: "eu-dora", name: "EU DORA", status: "active" },
    ];
    container.listLegislations.execute.mockResolvedValue(legislations);

    const res = await request(app).get("/api/v1/legislations");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(legislations);
    expect(container.listLegislations.execute).toHaveBeenCalled();
  });

  it("returns empty array when no legislations exist", async () => {
    container.listLegislations.execute.mockResolvedValue([]);

    const res = await request(app).get("/api/v1/legislations");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
