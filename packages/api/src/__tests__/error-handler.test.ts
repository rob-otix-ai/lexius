import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { ZodError } from "zod";
import { errorHandler } from "../middleware/error-handler.js";

function createErrorApp(error: unknown) {
  const app = express();
  app.use(express.json());

  app.get("/test", (_req, _res, next) => {
    next(error);
  });

  app.use(errorHandler);
  return app;
}

describe("errorHandler middleware", () => {
  it("returns 400 with details for ZodError", async () => {
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["legislationId"],
        message: "Required",
      },
    ]);

    const app = createErrorApp(zodError);
    const res = await request(app).get("/test");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual([
      { path: "legislationId", message: "Required" },
    ]);
  });

  it("returns 422 for domain errors with a message", async () => {
    const domainError = new Error("Legislation not found");

    const app = createErrorApp(domainError);
    const res = await request(app).get("/test");

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Domain error");
    expect(res.body.message).toBe("Legislation not found");
  });

  it("returns 500 for unknown errors", async () => {
    // A non-Error object with no message
    const unknownError = Object.create(null);

    const app = createErrorApp(unknownError);
    const res = await request(app).get("/test");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});
