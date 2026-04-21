import { describe, expect, it, beforeEach } from "vitest";
import { FakeCuratorEditRepository } from "./curator-fakes.js";
import { ListCuratorEdits } from "../../index.js";

describe("ListCuratorEdits", () => {
  let audit: FakeCuratorEditRepository;
  let useCase: ListCuratorEdits;

  beforeEach(() => {
    audit = new FakeCuratorEditRepository();
    useCase = new ListCuratorEdits(audit);
  });

  const insertEdit = async (
    editorId: string,
    entityId: string,
    at: Date,
  ): Promise<void> => {
    await audit.insert({
      entityType: "obligation",
      entityId,
      editorId,
      editorIp: null,
      editorUa: null,
      source: "cli",
      action: "update",
      oldValues: null,
      newValues: {},
      rowVersionBefore: 1,
      rowVersionAfter: 2,
      reason: "r",
      crossCheckResult: null,
    });
    // Normalise editedAt so "since" tests are deterministic.
    audit.edits[audit.edits.length - 1].editedAt = at;
  };

  it("returns empty when neither entity nor editor provided", async () => {
    await insertEdit("alice", "ob-1", new Date());
    const result = await useCase.execute({});
    expect(result).toEqual([]);
  });

  it("filters by entity", async () => {
    await insertEdit("alice", "ob-1", new Date("2026-04-01"));
    await insertEdit("bob", "ob-2", new Date("2026-04-02"));
    const result = await useCase.execute({
      entityType: "obligation",
      entityId: "ob-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].editorId).toBe("alice");
  });

  it("filters by editor", async () => {
    await insertEdit("alice", "ob-1", new Date("2026-04-01"));
    await insertEdit("alice", "ob-2", new Date("2026-04-02"));
    await insertEdit("bob", "ob-3", new Date("2026-04-03"));
    const result = await useCase.execute({ editorId: "alice" });
    expect(result).toHaveLength(2);
  });

  it("respects since cutoff when editor filter is set", async () => {
    await insertEdit("alice", "ob-1", new Date("2026-04-01"));
    await insertEdit("alice", "ob-2", new Date("2026-04-10"));
    const result = await useCase.execute({
      editorId: "alice",
      since: new Date("2026-04-05"),
    });
    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("ob-2");
  });
});
