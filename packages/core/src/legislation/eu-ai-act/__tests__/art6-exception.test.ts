import { describe, it, expect } from "vitest";
import { runArt6Exception } from "../assessments/art6-exception.js";

function makeInput(overrides: Record<string, unknown> = {}): Record<string, boolean> {
  return {
    performs_profiling: false,
    documented_assessment: true,
    narrow_procedural_task: false,
    improves_prior_human_activity: false,
    detects_patterns_without_replacing_review: false,
    preparatory_task: false,
    ...overrides,
  };
}

describe("runArt6Exception", () => {
  describe("profiling blocks exception", () => {
    it("profiling blocks exception regardless of other conditions", () => {
      const result = runArt6Exception(
        makeInput({
          performs_profiling: true,
          narrow_procedural_task: true,
          documented_assessment: true,
        }),
      );
      expect(result.result.exception_available).toBe(false);
      expect(result.result.profiling_blocks).toBe(true);
      expect(result.reasoning).toContain("profiling");
      expect(result.assessmentId).toBe("art6-exception");
    });
  });

  describe("exception available", () => {
    it("single condition met + documented → exception available", () => {
      const result = runArt6Exception(
        makeInput({ narrow_procedural_task: true, documented_assessment: true }),
      );
      expect(result.result.exception_available).toBe(true);
      expect(result.result.profiling_blocks).toBe(false);
    });

    it("all conditions met + documented → exception available", () => {
      const result = runArt6Exception(
        makeInput({
          narrow_procedural_task: true,
          improves_prior_human_activity: true,
          detects_patterns_without_replacing_review: true,
          preparatory_task: true,
          documented_assessment: true,
        }),
      );
      expect(result.result.exception_available).toBe(true);
    });
  });

  describe("exception not available", () => {
    it("no conditions met → not available", () => {
      const result = runArt6Exception(makeInput({ documented_assessment: true }));
      expect(result.result.exception_available).toBe(false);
      expect(result.result.profiling_blocks).toBe(false);
    });

    it("conditions met but not documented → not available", () => {
      const result = runArt6Exception(
        makeInput({ narrow_procedural_task: true, documented_assessment: false }),
      );
      expect(result.result.exception_available).toBe(false);
    });
  });

  describe("each of the 4 conditions individually", () => {
    const conditions = [
      "narrow_procedural_task",
      "improves_prior_human_activity",
      "detects_patterns_without_replacing_review",
      "preparatory_task",
    ] as const;

    for (const condition of conditions) {
      it(`${condition} alone + documented → exception available`, () => {
        const result = runArt6Exception(
          makeInput({ [condition]: true, documented_assessment: true }),
        );
        expect(result.result.exception_available).toBe(true);
      });
    }
  });

  describe("relevant articles", () => {
    it("includes Article 6(3) in all outcomes", () => {
      const result = runArt6Exception(
        makeInput({ narrow_procedural_task: true, documented_assessment: true }),
      );
      expect(result.relevantArticles).toContain("Article 6(3)");
    });
  });

  describe("invalid input types throw errors", () => {
    it("throws when performs_profiling is not a boolean", () => {
      expect(() =>
        runArt6Exception(makeInput({ performs_profiling: "yes" as unknown as boolean })),
      ).toThrow("performs_profiling must be a boolean");
    });

    it("throws when documented_assessment is not a boolean", () => {
      expect(() =>
        runArt6Exception(makeInput({ documented_assessment: 1 as unknown as boolean })),
      ).toThrow("documented_assessment must be a boolean");
    });

    it("throws when a required field is missing", () => {
      const input = makeInput();
      delete (input as Record<string, unknown>).narrow_procedural_task;
      expect(() => runArt6Exception(input)).toThrow("must be a boolean");
    });
  });
});
