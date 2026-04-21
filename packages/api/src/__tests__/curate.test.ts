import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestApp } from "./setup.js";
import {
  AuthoritativeImmutable,
  CrossCheckFailed,
  DerivedFromRequired,
  DerivedFromUnresolved,
  DerivedFromImmutable,
  EditNotFound,
  EditNotRevertable,
  ObligationNotFound,
  ReasonRequired,
  RowVersionMismatch,
} from "@lexius/core";

describe("curator routes", () => {
  let app: Express;
  let container: ReturnType<typeof createTestApp>["container"];

  beforeEach(() => {
    ({ app, container } = createTestApp({ role: "curator" }));
  });

  describe("role gate", () => {
    it("403 when role is reader", async () => {
      ({ app } = createTestApp({ role: "reader" }));
      const res = await request(app).get("/api/v1/curate/whoami");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("curator_role_required");
    });

    it("200 for curator", async () => {
      const res = await request(app).get("/api/v1/curate/whoami");
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("curator");
    });
  });

  describe("POST /api/v1/curate/obligations", () => {
    const bodyFor = (overrides: Record<string, unknown> = {}) => ({
      id: "eu-ai-act-art-9-provider",
      legislationId: "eu-ai-act",
      role: "provider",
      riskLevel: "high-risk",
      obligation: "Establish a risk management system",
      derivedFrom: ["eu-ai-act-art-9"],
      reason: "new obligation",
      ...overrides,
    });

    it("201 on successful create", async () => {
      container.curator!.createCuratedObligation.execute.mockResolvedValue({
        dryRun: false,
        obligation: {
          id: "eu-ai-act-art-9-provider",
          legislationId: "eu-ai-act",
          role: "provider",
          riskLevel: "high-risk",
          obligation: "text",
          article: "",
          deadline: null,
          details: "",
          category: "",
          derivedFrom: ["eu-ai-act-art-9"],
          provenance: { tier: "CURATED", curatedBy: "test@example.com", reviewedAt: new Date() },
          rowVersion: 1,
          needsReview: false,
          staleSince: null,
          deprecatedAt: null,
          deprecatedReason: null,
        },
      });
      const res = await request(app)
        .post("/api/v1/curate/obligations")
        .send(bodyFor());
      expect(res.status).toBe(201);
      expect(res.body.obligation.row_version).toBe(1);
    });

    it("422 on empty derivedFrom (DerivedFromRequired)", async () => {
      container.curator!.createCuratedObligation.execute.mockRejectedValue(
        new DerivedFromRequired(),
      );
      const res = await request(app)
        .post("/api/v1/curate/obligations")
        .send(bodyFor());
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("derived_from_required");
    });

    it("422 on unresolved derivedFrom with missing list", async () => {
      container.curator!.createCuratedObligation.execute.mockRejectedValue(
        new DerivedFromUnresolved(["missing-art-1"]),
      );
      const res = await request(app)
        .post("/api/v1/curate/obligations")
        .send(bodyFor());
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("derived_from_unresolved");
      expect(res.body.missing).toEqual(["missing-art-1"]);
    });

    it("dry-run via ?dry_run=true returns 200 not 201", async () => {
      container.curator!.createCuratedObligation.execute.mockResolvedValue({
        dryRun: true,
        obligation: null,
      });
      const res = await request(app)
        .post("/api/v1/curate/obligations?dry_run=true")
        .send(bodyFor());
      expect(res.status).toBe(200);
      expect(res.body.dry_run).toBe(true);
    });
  });

  describe("PATCH /api/v1/curate/obligations/:id", () => {
    it("428 when If-Match header missing", async () => {
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .send({ changes: {}, reason: "x" });
      expect(res.status).toBe(428);
      expect(res.body.error).toBe("if_match_required");
    });

    it("409 with current version on row_version mismatch", async () => {
      container.curator!.updateCuratedObligation.execute.mockRejectedValue(
        new RowVersionMismatch(7),
      );
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .set("If-Match", "3")
        .send({ changes: { obligation: "new" }, reason: "r" });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("row_version_mismatch");
      expect(res.body.current).toBe(7);
    });

    it("403 on AUTHORITATIVE", async () => {
      container.curator!.updateCuratedObligation.execute.mockRejectedValue(
        new AuthoritativeImmutable(),
      );
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ changes: { obligation: "new" }, reason: "r" });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("authoritative_immutable");
    });

    it("422 on DerivedFromImmutable", async () => {
      container.curator!.updateCuratedObligation.execute.mockRejectedValue(
        new DerivedFromImmutable(),
      );
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ changes: {}, reason: "r" });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("derived_from_immutable");
    });

    it("422 on CrossCheckFailed with mismatches", async () => {
      const mismatches = [
        {
          field: "maxFineEur",
          proposedValue: "36000000",
          extractedValues: ["35000000"],
          derivedFrom: ["eu-ai-act-art-99"],
          suggestion: "update to 35000000",
        },
      ];
      container.curator!.updateCuratedObligation.execute.mockRejectedValue(
        new CrossCheckFailed(mismatches),
      );
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ changes: {}, reason: "r" });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("cross_check_failed");
      expect(res.body.mismatches).toEqual(mismatches);
    });

    it("200 on successful update with cross-check + embedding signal", async () => {
      container.curator!.updateCuratedObligation.execute.mockResolvedValue({
        dryRun: false,
        obligation: {
          id: "abc",
          legislationId: "eu-ai-act",
          role: "provider",
          riskLevel: "high-risk",
          obligation: "new",
          article: "",
          deadline: null,
          details: "",
          category: "",
          derivedFrom: ["eu-ai-act-art-9"],
          provenance: { tier: "CURATED", curatedBy: "test@example.com", reviewedAt: new Date() },
          rowVersion: 2,
          needsReview: false,
          staleSince: null,
          deprecatedAt: null,
          deprecatedReason: null,
        },
        crossCheckResult: { ok: true },
        embeddingRegenerated: true,
      });
      const res = await request(app)
        .patch("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ changes: { obligation: "new" }, reason: "fix typo" });
      expect(res.status).toBe(200);
      expect(res.body.obligation.row_version).toBe(2);
      expect(res.body.cross_check_result).toEqual({ ok: true });
      expect(res.body.embedding_regenerated).toBe(true);
    });
  });

  describe("DELETE /api/v1/curate/obligations/:id", () => {
    it("200 on successful deprecate", async () => {
      container.curator!.deprecateCuratedObligation.execute.mockResolvedValue({
        dryRun: false,
        obligation: {
          id: "abc",
          legislationId: "eu-ai-act",
          role: "p",
          riskLevel: "h",
          obligation: "o",
          article: "",
          deadline: null,
          details: "",
          category: "",
          derivedFrom: ["x"],
          provenance: { tier: "CURATED", curatedBy: "t", reviewedAt: new Date() },
          rowVersion: 2,
          needsReview: false,
          staleSince: null,
          deprecatedAt: new Date(),
          deprecatedReason: "superseded",
        },
      });
      const res = await request(app)
        .delete("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ reason: "superseded" });
      expect(res.status).toBe(200);
      expect(res.body.obligation.deprecated_reason).toBe("superseded");
    });

    it("404 on missing", async () => {
      container.curator!.deprecateCuratedObligation.execute.mockRejectedValue(
        new ObligationNotFound("abc"),
      );
      const res = await request(app)
        .delete("/api/v1/curate/obligations/abc")
        .set("If-Match", "1")
        .send({ reason: "x" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/curate/obligations/:id/revert", () => {
    it("200 on successful revert", async () => {
      container.curator!.revertCuratorEdit.execute.mockResolvedValue({
        dryRun: false,
        obligation: {
          id: "abc",
          legislationId: "eu-ai-act",
          role: "p",
          riskLevel: "h",
          obligation: "reverted",
          article: "",
          deadline: null,
          details: "",
          category: "",
          derivedFrom: ["x"],
          provenance: { tier: "CURATED", curatedBy: "t", reviewedAt: new Date() },
          rowVersion: 3,
          needsReview: false,
          staleSince: null,
          deprecatedAt: null,
          deprecatedReason: null,
        },
      });
      const res = await request(app)
        .post("/api/v1/curate/obligations/abc/revert")
        .send({ editId: "edit-1", reason: "revert typo" });
      expect(res.status).toBe(200);
      expect(res.body.obligation.row_version).toBe(3);
    });

    it("404 on EditNotFound", async () => {
      container.curator!.revertCuratorEdit.execute.mockRejectedValue(
        new EditNotFound("nope"),
      );
      const res = await request(app)
        .post("/api/v1/curate/obligations/abc/revert")
        .send({ editId: "nope", reason: "r" });
      expect(res.status).toBe(404);
    });

    it("409 on EditNotRevertable", async () => {
      container.curator!.revertCuratorEdit.execute.mockRejectedValue(
        new EditNotRevertable("create edits not revertable"),
      );
      const res = await request(app)
        .post("/api/v1/curate/obligations/abc/revert")
        .send({ editId: "x", reason: "r" });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/v1/curate/edits", () => {
    it("returns edits filtered by entity", async () => {
      container.curator!.listCuratorEdits.execute.mockResolvedValue([
        {
          id: "e1",
          entityType: "obligation",
          entityId: "abc",
          editorId: "rob@fall.dev",
          editorIp: null,
          editorUa: null,
          source: "api",
          action: "update",
          oldValues: null,
          newValues: {},
          rowVersionBefore: 1,
          rowVersionAfter: 2,
          reason: "typo",
          crossCheckResult: null,
          editedAt: new Date("2026-04-21T10:00:00Z"),
        },
      ]);
      const res = await request(app)
        .get("/api/v1/curate/edits?entity_type=obligation&entity_id=abc");
      expect(res.status).toBe(200);
      expect(res.body.edits).toHaveLength(1);
      expect(res.body.edits[0].editor_id).toBe("rob@fall.dev");
      expect(res.body.edits[0].row_version_before).toBe(1);
      expect(res.body.edits[0].row_version_after).toBe(2);
    });
  });

  describe("GET /api/v1/curate/queue", () => {
    it("returns stale obligations", async () => {
      container.obligationRepo.findStale.mockResolvedValue([
        {
          id: "abc",
          legislationId: "eu-ai-act",
          role: "provider",
          riskLevel: "high-risk",
          obligation: "text",
          article: "",
          deadline: null,
          details: "",
          category: "",
          derivedFrom: ["eu-ai-act-art-9"],
          provenance: { tier: "CURATED", curatedBy: "t", reviewedAt: new Date() },
          rowVersion: 1,
          needsReview: true,
          staleSince: new Date("2026-04-01T00:00:00Z"),
          deprecatedAt: null,
          deprecatedReason: null,
        },
      ]);
      const res = await request(app).get("/api/v1/curate/queue");
      expect(res.status).toBe(200);
      expect(res.body.obligations).toHaveLength(1);
      expect(res.body.obligations[0].needs_review).toBe(true);
    });
  });
});

// ReasonRequired still surfaces via Zod validation before the use case
// runs, so it's tested implicitly by every route's "reason required"
// body schema. Adding a direct assertion for clarity.
describe("reason required (zod)", () => {
  let app: Express;
  beforeEach(() => {
    ({ app } = createTestApp({ role: "curator" }));
  });

  it("missing reason on update returns 500 (zod error) rather than silently writing", async () => {
    const res = await request(app)
      .patch("/api/v1/curate/obligations/abc")
      .set("If-Match", "1")
      .send({ changes: { obligation: "new" } });
    // Zod rejection bubbles through the default error handler.
    expect([400, 500]).toContain(res.status);
  });
});
