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
  AuthoritativeImmutable,
  RowVersionMismatch,
  ReasonRequired,
  ObligationNotFound,
  DerivedFromImmutable,
} from "../../index.js";

describe("UpdateCuratedObligation", () => {
  let obligations: FakeObligationRepository;
  let audit: FakeCuratorEditRepository;
  let articles: FakeArticleRepository;
  let embeddings: FakeEmbeddingService;
  let crossCheck: FakeCrossCheckService;
  let tx: FakeTransactionManager;
  let useCase: UpdateCuratedObligation;

  beforeEach(() => {
    obligations = new FakeObligationRepository();
    audit = new FakeCuratorEditRepository();
    articles = new FakeArticleRepository();
    embeddings = new FakeEmbeddingService();
    crossCheck = new FakeCrossCheckService();
    tx = new FakeTransactionManager(obligations, audit, articles);
    useCase = new UpdateCuratedObligation(
      obligations,
      audit,
      embeddings,
      crossCheck,
      tx,
      () => new Date("2026-04-21T10:00:00Z"),
    );
    obligations.seed(makeObligation());
  });

  it("updates text, bumps row_version, stamps curatedBy + reviewedAt, inserts audit", async () => {
    const result = await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice@example.com",
      source: "cli",
      reason: "clarifying provider obligation",
      changes: { obligation: "Establish and maintain a risk management system" },
    });

    expect(result.dryRun).toBe(false);
    expect(result.obligation?.rowVersion).toBe(2);
    expect(result.obligation?.obligation).toBe(
      "Establish and maintain a risk management system",
    );
    expect(result.obligation?.provenance.tier).toBe("CURATED");
    if (result.obligation?.provenance.tier === "CURATED") {
      expect(result.obligation.provenance.curatedBy).toBe("alice@example.com");
    }
    expect(result.embeddingRegenerated).toBe(true);

    expect(audit.edits).toHaveLength(1);
    expect(audit.edits[0].action).toBe("update");
    expect(audit.edits[0].editorId).toBe("alice@example.com");
    expect(audit.edits[0].reason).toBe("clarifying provider obligation");
    expect(audit.edits[0].rowVersionBefore).toBe(1);
    expect(audit.edits[0].rowVersionAfter).toBe(2);
  });

  it("rejects empty reason", async () => {
    await expect(
      useCase.execute({
        obligationId: "eu-ai-act-art-9-provider",
        rowVersion: 1,
        editorId: "alice@example.com",
        source: "cli",
        reason: "",
        changes: { obligation: "new text" },
      }),
    ).rejects.toBeInstanceOf(ReasonRequired);
  });

  it("rejects stale rowVersion with RowVersionMismatch carrying current value", async () => {
    try {
      await useCase.execute({
        obligationId: "eu-ai-act-art-9-provider",
        rowVersion: 99,
        editorId: "alice@example.com",
        source: "cli",
        reason: "stale",
        changes: { obligation: "x" },
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RowVersionMismatch);
      expect((err as RowVersionMismatch).current).toBe(1);
    }
  });

  it("rejects updates to AUTHORITATIVE rows", async () => {
    obligations.seed(
      makeObligation({
        id: "authoritative-row",
        provenance: {
          tier: "AUTHORITATIVE",
          sourceUrl: "https://eur-lex.europa.eu/x",
          sourceHash: "deadbeef",
          fetchedAt: new Date(),
        },
      }),
    );
    await expect(
      useCase.execute({
        obligationId: "authoritative-row",
        rowVersion: 1,
        editorId: "alice@example.com",
        source: "cli",
        reason: "attempt to override verbatim",
        changes: { obligation: "rewritten" },
      }),
    ).rejects.toBeInstanceOf(AuthoritativeImmutable);
  });

  it("rejects missing obligation", async () => {
    await expect(
      useCase.execute({
        obligationId: "does-not-exist",
        rowVersion: 1,
        editorId: "alice@example.com",
        source: "cli",
        reason: "x",
        changes: { obligation: "x" },
      }),
    ).rejects.toBeInstanceOf(ObligationNotFound);
  });

  it("rejects attempts to mutate derivedFrom", async () => {
    await expect(
      useCase.execute({
        obligationId: "eu-ai-act-art-9-provider",
        rowVersion: 1,
        editorId: "alice@example.com",
        source: "cli",
        reason: "cutting the anchor",
        changes: { derivedFrom: ["eu-ai-act-art-99"] } as any,
      }),
    ).rejects.toBeInstanceOf(DerivedFromImmutable);
  });

  it("dry run does not mutate row and writes no audit", async () => {
    const result = await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice@example.com",
      source: "cli",
      reason: "preview only",
      changes: { obligation: "new text" },
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(audit.edits).toHaveLength(0);
    const after = await obligations.findById("eu-ai-act-art-9-provider");
    expect(after?.rowVersion).toBe(1);
    expect(after?.obligation).toBe("Establish a risk management system");
  });

  it("clears needs_review + stale_since on successful edit", async () => {
    obligations.seed(
      makeObligation({
        needsReview: true,
        staleSince: new Date("2026-04-01T00:00:00Z"),
      }),
    );

    await useCase.execute({
      obligationId: "eu-ai-act-art-9-provider",
      rowVersion: 1,
      editorId: "alice@example.com",
      source: "cli",
      reason: "reviewed, content still accurate",
      changes: { obligation: "Establish a risk management system" },
    });

    const after = await obligations.findById("eu-ai-act-art-9-provider");
    expect(after?.needsReview).toBe(false);
    expect(after?.staleSince).toBeNull();
  });
});
