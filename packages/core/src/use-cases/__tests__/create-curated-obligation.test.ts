import { describe, expect, it, beforeEach } from "vitest";
import {
  FakeObligationRepository,
  FakeCuratorEditRepository,
  FakeArticleRepository,
  FakeEmbeddingService,
  FakeTransactionManager,
} from "./curator-fakes.js";
import {
  CreateCuratedObligation,
  DerivedFromRequired,
  DerivedFromUnresolved,
  ReasonRequired,
} from "../../index.js";

describe("CreateCuratedObligation", () => {
  let obligations: FakeObligationRepository;
  let audit: FakeCuratorEditRepository;
  let articles: FakeArticleRepository;
  let embeddings: FakeEmbeddingService;
  let tx: FakeTransactionManager;
  let useCase: CreateCuratedObligation;

  beforeEach(() => {
    obligations = new FakeObligationRepository();
    audit = new FakeCuratorEditRepository();
    articles = new FakeArticleRepository();
    embeddings = new FakeEmbeddingService();
    tx = new FakeTransactionManager(obligations, audit, articles);
    useCase = new CreateCuratedObligation(obligations, audit, embeddings, tx);
    articles.existingIds.add("eu-ai-act-art-9");
  });

  const baseInput = {
    id: "eu-ai-act-art-9-operator",
    legislationId: "eu-ai-act",
    role: "operator",
    riskLevel: "high-risk",
    obligation: "Operator shall monitor the system in operation",
    article: "9",
    deadline: null,
    details: "",
    category: "monitoring",
    derivedFrom: ["eu-ai-act-art-9"],
  };

  it("creates and writes audit with action='create'", async () => {
    const result = await useCase.execute({
      obligation: baseInput,
      editorId: "alice@example.com",
      source: "cli",
      reason: "new obligation for operators",
    });

    expect(result.dryRun).toBe(false);
    expect(result.obligation?.rowVersion).toBe(1);
    expect(result.obligation?.provenance.tier).toBe("CURATED");
    expect(audit.edits).toHaveLength(1);
    expect(audit.edits[0].action).toBe("create");
    expect(audit.edits[0].oldValues).toBeNull();
    expect(audit.edits[0].rowVersionBefore).toBeNull();
    expect(audit.edits[0].rowVersionAfter).toBe(1);
  });

  it("rejects empty reason", async () => {
    await expect(
      useCase.execute({
        obligation: baseInput,
        editorId: "alice",
        source: "cli",
        reason: "",
      }),
    ).rejects.toBeInstanceOf(ReasonRequired);
  });

  it("rejects empty derivedFrom (C-INT-007)", async () => {
    await expect(
      useCase.execute({
        obligation: { ...baseInput, derivedFrom: [] },
        editorId: "alice",
        source: "cli",
        reason: "orphan interpretation",
      }),
    ).rejects.toBeInstanceOf(DerivedFromRequired);
  });

  it("rejects derivedFrom with ids that do not resolve", async () => {
    await expect(
      useCase.execute({
        obligation: { ...baseInput, derivedFrom: ["bogus-art-1"] },
        editorId: "alice",
        source: "cli",
        reason: "bad anchor",
      }),
    ).rejects.toBeInstanceOf(DerivedFromUnresolved);
  });

  it("DerivedFromUnresolved carries the missing id list", async () => {
    try {
      await useCase.execute({
        obligation: {
          ...baseInput,
          derivedFrom: ["eu-ai-act-art-9", "missing-x", "missing-y"],
        },
        editorId: "alice",
        source: "cli",
        reason: "bad anchor",
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DerivedFromUnresolved);
      expect((err as DerivedFromUnresolved).missing).toEqual([
        "missing-x",
        "missing-y",
      ]);
    }
  });

  it("dry run returns null obligation and writes no audit", async () => {
    const result = await useCase.execute({
      obligation: baseInput,
      editorId: "alice",
      source: "cli",
      reason: "preview",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.obligation).toBeNull();
    expect(audit.edits).toHaveLength(0);
    expect(obligations.rows.size).toBe(0);
  });
});
