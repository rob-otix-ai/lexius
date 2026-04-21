import { describe, expect, it, beforeEach } from "vitest";
import {
  FakeObligationRepository,
  FakeCuratorEditRepository,
  FakeArticleRepository,
  FakeTransactionManager,
  makeObligation,
} from "./curator-fakes.js";
import {
  DeprecateCuratedObligation,
  AuthoritativeImmutable,
  RowVersionMismatch,
  ReasonRequired,
  ObligationNotFound,
} from "../../index.js";

describe("DeprecateCuratedObligation", () => {
  let obligations: FakeObligationRepository;
  let audit: FakeCuratorEditRepository;
  let articles: FakeArticleRepository;
  let tx: FakeTransactionManager;
  let useCase: DeprecateCuratedObligation;

  beforeEach(() => {
    obligations = new FakeObligationRepository();
    audit = new FakeCuratorEditRepository();
    articles = new FakeArticleRepository();
    tx = new FakeTransactionManager(obligations, audit, articles);
    useCase = new DeprecateCuratedObligation(obligations, audit, tx);
    obligations.seed(makeObligation());
  });

  it("sets deprecatedAt + deprecatedReason, bumps row_version, audits action='deprecate'", async () => {
    const result = await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice",
      source: "cli",
      reason: "superseded by Art. 9(2)",
    });

    expect(result.obligation?.deprecatedAt).toBeInstanceOf(Date);
    expect(result.obligation?.deprecatedReason).toBe("superseded by Art. 9(2)");
    expect(result.obligation?.rowVersion).toBe(2);
    expect(audit.edits).toHaveLength(1);
    expect(audit.edits[0].action).toBe("deprecate");
  });

  it("idempotent: deprecating an already-deprecated row is a no-op", async () => {
    await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice",
      source: "cli",
      reason: "first call",
    });
    const after1 = await obligations.findById("eu-ai-act-art-9-provider");

    // Second call at new row_version — the use case notices already deprecated
    // and returns without writing a second audit row.
    const result2 = await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 2,
      editorId: "alice",
      source: "cli",
      reason: "second call",
    });

    expect(audit.edits).toHaveLength(1);
    expect(result2.obligation?.rowVersion).toBe(after1?.rowVersion);
  });

  it("rejects AUTHORITATIVE", async () => {
    obligations.seed(
      makeObligation({
        id: "auth",
        provenance: {
          tier: "AUTHORITATIVE",
          sourceUrl: "x",
          sourceHash: "y",
          fetchedAt: new Date(),
        },
      }),
    );
    await expect(
      useCase.execute({
        obligationId: "auth",
        rowVersion: 1,
        editorId: "alice",
        source: "cli",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(AuthoritativeImmutable);
  });

  it("rejects missing", async () => {
    await expect(
      useCase.execute({
        obligationId: "none",
        rowVersion: 1,
        editorId: "alice",
        source: "cli",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(ObligationNotFound);
  });

  it("rejects empty reason", async () => {
    await expect(
      useCase.execute({
        obligationId: "eu-ai-act-art-9-provider",
        rowVersion: 1,
        editorId: "alice",
        source: "cli",
        reason: "",
      }),
    ).rejects.toBeInstanceOf(ReasonRequired);
  });

  it("rejects stale rowVersion", async () => {
    await expect(
      useCase.execute({
        obligationId: "eu-ai-act-art-9-provider",
        rowVersion: 99,
        editorId: "alice",
        source: "cli",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(RowVersionMismatch);
  });
});
