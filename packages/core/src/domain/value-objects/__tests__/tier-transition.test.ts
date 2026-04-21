import { describe, expect, it } from "vitest";
import {
  assertTierTransition,
  isTierTransitionAllowed,
  TierTransitionForbidden,
  TIER_TRANSITION_MATRIX,
} from "../tier-transition.js";

describe("tier transitions", () => {
  describe("matrix", () => {
    it("covers all 9 cells", () => {
      expect(TIER_TRANSITION_MATRIX).toHaveLength(9);
    });

    it.each([
      ["AUTHORITATIVE", "AUTHORITATIVE", false],
      ["AUTHORITATIVE", "CURATED", false],
      ["AUTHORITATIVE", "AI_GENERATED", false],
      ["CURATED", "CURATED", true],
      ["CURATED", "AUTHORITATIVE", false],
      ["CURATED", "AI_GENERATED", false],
      ["AI_GENERATED", "AI_GENERATED", true],
      ["AI_GENERATED", "CURATED", true],
      ["AI_GENERATED", "AUTHORITATIVE", false],
    ] as const)("%s -> %s = %s", (from, to, allowed) => {
      expect(isTierTransitionAllowed(from, to)).toBe(allowed);
    });
  });

  describe("assertTierTransition", () => {
    it("passes for allowed transitions", () => {
      expect(() => assertTierTransition("CURATED", "CURATED")).not.toThrow();
      expect(() => assertTierTransition("AI_GENERATED", "CURATED")).not.toThrow();
    });

    it("throws TierTransitionForbidden for forbidden transitions", () => {
      expect(() => assertTierTransition("AUTHORITATIVE", "CURATED")).toThrow(
        TierTransitionForbidden,
      );
      expect(() => assertTierTransition("CURATED", "AI_GENERATED")).toThrow(
        TierTransitionForbidden,
      );
    });

    it("error carries from/to on the instance", () => {
      try {
        assertTierTransition("AUTHORITATIVE", "CURATED");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TierTransitionForbidden);
        expect((err as TierTransitionForbidden).from).toBe("AUTHORITATIVE");
        expect((err as TierTransitionForbidden).to).toBe("CURATED");
      }
    });
  });

  describe("invariants", () => {
    it("AUTHORITATIVE is a terminal tier — no transitions allowed out", () => {
      const fromAuth = TIER_TRANSITION_MATRIX.filter((c) => c.from === "AUTHORITATIVE");
      expect(fromAuth.every((c) => c.allowed === false)).toBe(true);
    });

    it("CURATED -> AI_GENERATED is forbidden (no downgrade)", () => {
      expect(isTierTransitionAllowed("CURATED", "AI_GENERATED")).toBe(false);
    });

    it("AI_GENERATED -> CURATED is the promotion path", () => {
      expect(isTierTransitionAllowed("AI_GENERATED", "CURATED")).toBe(true);
    });
  });
});
