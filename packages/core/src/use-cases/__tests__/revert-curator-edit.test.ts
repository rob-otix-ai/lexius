import { describe, expect, it, beforeEach } from "vitest";
import {
  FakeObligationRepository,
  FakeCuratorEditRepository,
  FakeArticleRepository,
  FakeEmbeddingService,
  FakeCrossCheckService,
  FakeTransactionManager,
  makeObligation,
} from "./curator-fakes.js";
import {
  UpdateCuratedObligation,
  RevertCuratorEdit,
  EditNotFound,
  EditNotRevertable,
  ReasonRequired,
} from "../../index.js";

describe("RevertCuratorEdit", () => {
  let obligations: FakeObligationRepository;
  let audit: FakeCuratorEditRepository;
  let articles: FakeArticleRepository;
  let embeddings: FakeEmbeddingService;
  let crossCheck: FakeCrossCheckService;
  let tx: FakeTransactionManager;
  let update: UpdateCuratedObligation;
  let revert: RevertCuratorEdit;

  beforeEach(() => {
    obligations = new FakeObligationRepository();
    audit = new FakeCuratorEditRepository();
    articles = new FakeArticleRepository();
    embeddings = new FakeEmbeddingService();
    crossCheck = new FakeCrossCheckService();
    tx = new FakeTransactionManager(obligations, audit, articles);
    update = new UpdateCuratedObligation(
      obligations,
      audit,
      embeddings,
      crossCheck,
      tx,
    );
    revert = new RevertCuratorEdit(obligations, audit, embeddings, tx);
    obligations.seed(makeObligation());
  });

  it("restores old values, writes a new audit row with action='revert'", async () => {
    await update.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice",
      source: "cli",
      reason: "refine wording",
      changes: { obligation: "typo version" },
    });

    const result = await revert.execute({
      editId: audit.edits[0].id,
      editorId: "bob",
      source: "cli",
      reason: "reverting alice's typo",
    });

    expect(result.obligation?.obligation).toBe("Establish a risk management system");
    expect(result.obligation?.rowVersion).toBe(3);
    expect(audit.edits).toHaveLength(2);
    expect(audit.edits[1].action).toBe("revert");
    expect(audit.edits[1].editorId).toBe("bob");
  });

  it("rejects when edit id not found", async () => {
    await expect(
      revert.execute({
        editId: "nonexistent",
        editorId: "bob",
        source: "cli",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(EditNotFound);
  });

  it("refuses to revert a create action (use deprecate instead)", async () => {
    audit.edits.push({
      id: "create-edit",
      entityType: "obligation",
      entityId: "x",
      editorId: "alice",
      editorIp: null,
      editorUa: null,
      source: "cli",
      action: "create",
      oldValues: null,
      newValues: {},
      rowVersionBefore: null,
      rowVersionAfter: 1,
      reason: "created",
      crossCheckResult: null,
      editedAt: new Date(),
    });
    await expect(
      revert.execute({
        editId: "create-edit",
        editorId: "bob",
        source: "cli",
        reason: "undo create",
      }),
    ).rejects.toBeInstanceOf(EditNotRevertable);
  });

  it("rejects empty reason", async () => {
    await expect(
      revert.execute({
        editId: "x",
        editorId: "bob",
        source: "cli",
        reason: "",
      }),
    ).rejects.toBeInstanceOf(ReasonRequired);
  });
});
