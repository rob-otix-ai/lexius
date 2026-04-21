import { describe, expect, it } from "vitest";
import {
  touchesNumericFields,
  numericFieldsFor,
  CrossCheckFailed,
} from "../cross-check.js";

describe("cross-check field detection", () => {
  it("obligations have no numerically-adjudicable fields in v1", () => {
    expect(numericFieldsFor("obligation")).toEqual([]);
    expect(touchesNumericFields("obligation", { obligation: "new text" })).toBe(false);
    expect(touchesNumericFields("obligation", { deadline: new Date() })).toBe(false);
  });

  it("penalties adjudicate maxFineEur and globalTurnoverPercentage", () => {
    expect(numericFieldsFor("penalty")).toEqual([
      "maxFineEur",
      "globalTurnoverPercentage",
    ]);
    expect(touchesNumericFields("penalty", { maxFineEur: "35000000" })).toBe(true);
    expect(
      touchesNumericFields("penalty", { globalTurnoverPercentage: "7" }),
    ).toBe(true);
    expect(touchesNumericFields("penalty", { description: "..." })).toBe(false);
  });
});

describe("CrossCheckFailed error", () => {
  it("carries the mismatch list", () => {
    const mismatches = [
      {
        field: "maxFineEur",
        proposedValue: "36000000",
        extractedValues: ["35000000"],
        derivedFrom: ["eu-ai-act-art-99"],
        suggestion: "update to 35000000",
      },
    ];
    const err = new CrossCheckFailed(mismatches);
    expect(err.name).toBe("CrossCheckFailed");
    expect(err.mismatches).toBe(mismatches);
    expect(err.message).toContain("1 mismatch");
  });
});
