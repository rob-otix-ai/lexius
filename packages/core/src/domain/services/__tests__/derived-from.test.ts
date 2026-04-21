import { describe, expect, it } from "vitest";
import {
  assertDerivedFromNonEmpty,
  assertDerivedFromResolves,
  DerivedFromRequired,
  DerivedFromUnresolved,
  type ArticleExistenceChecker,
} from "../derived-from.js";

describe("assertDerivedFromNonEmpty", () => {
  it("throws DerivedFromRequired for undefined", () => {
    expect(() => assertDerivedFromNonEmpty(undefined)).toThrow(DerivedFromRequired);
  });

  it("throws DerivedFromRequired for empty array", () => {
    expect(() => assertDerivedFromNonEmpty([])).toThrow(DerivedFromRequired);
  });

  it("passes for non-empty array", () => {
    expect(() => assertDerivedFromNonEmpty(["eu-ai-act-art-9"])).not.toThrow();
  });
});

describe("assertDerivedFromResolves", () => {
  const makeChecker = (missing: string[]): ArticleExistenceChecker => ({
    findMissing: async () => missing,
  });

  it("passes when checker returns no missing ids", async () => {
    await expect(
      assertDerivedFromResolves(makeChecker([]), ["eu-ai-act-art-9"]),
    ).resolves.toBeUndefined();
  });

  it("throws DerivedFromUnresolved when checker returns missing ids", async () => {
    await expect(
      assertDerivedFromResolves(makeChecker(["bogus-art-1"]), ["bogus-art-1"]),
    ).rejects.toBeInstanceOf(DerivedFromUnresolved);
  });

  it("error carries the list of missing ids", async () => {
    try {
      await assertDerivedFromResolves(
        makeChecker(["missing-a", "missing-b"]),
        ["missing-a", "missing-b", "real-c"],
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DerivedFromUnresolved);
      expect((err as DerivedFromUnresolved).missing).toEqual([
        "missing-a",
        "missing-b",
      ]);
    }
  });
});
