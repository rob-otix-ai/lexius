import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/fine-amount-kyd.js";
import { wordsToNumber } from "../../extractors/fine-amount-kyd.js";

describe("extractors/fine-amount-kyd", () => {
  it("extracts word-form 'fine of ten thousand dollars' → 10000", () => {
    const text =
      "Any person who contravenes this section is liable to a fine of ten thousand dollars.";
    const results = extract(text, "cima-test-s1", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].extractType).toBe("fine_amount_kyd");
    expect(results[0].valueNumeric).toBe("10000");
  });

  it("extracts word-form 'fine of one hundred thousand dollars' → 100000", () => {
    const text =
      "A person who commits an offence is liable to a fine of one hundred thousand dollars.";
    const results = extract(text, "cima-test-s2", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueNumeric).toBe("100000");
  });

  it("extracts word-form 'fine of fifty thousand dollars' → 50000", () => {
    const text =
      "On conviction, a penalty of fifty thousand dollars shall be imposed.";
    const results = extract(text, "cima-test-s3", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueNumeric).toBe("50000");
  });

  it("extracts word-form 'fine of twenty thousand dollars' → 20000", () => {
    const text =
      "The fine shall not exceed twenty thousand dollars.";
    const results = extract(text, "cima-test-s4", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueNumeric).toBe("20000");
  });

  it("does NOT match word-form dollars outside fine/penalty context", () => {
    const text =
      "The annual turnover of one million dollars was reported in the filing.";
    const results = extract(text, "cima-test-s5", "cima-test");
    expect(results).toHaveLength(0);
  });

  it("extracts numeric dollar amounts in penalty context", () => {
    const text =
      "Any person guilty of an offence is liable to a fine of 50,000 dollars.";
    const results = extract(text, "cima-test-s6", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueNumeric).toBe("50000");
  });

  it("all emitted rows carry the required provenance fields", () => {
    const text =
      "A person convicted is liable to a fine of ten thousand dollars.";
    const [row] = extract(text, "cima-test-s7", "cima-test");
    expect(row.articleId).toBe("cima-test-s7");
    expect(row.extractType).toBe("fine_amount_kyd");
    expect(row.valueNumeric).toBe("10000");
    expect(row.verbatimExcerpt).toContain("ten thousand dollars");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("wordsToNumber", () => {
  it("ten thousand → 10000", () => expect(wordsToNumber("ten thousand")).toBe(10000));
  it("one hundred thousand → 100000", () => expect(wordsToNumber("one hundred thousand")).toBe(100000));
  it("fifty thousand → 50000", () => expect(wordsToNumber("fifty thousand")).toBe(50000));
  it("twenty thousand → 20000", () => expect(wordsToNumber("twenty thousand")).toBe(20000));
  it("one million → 1000000", () => expect(wordsToNumber("one million")).toBe(1000000));
  it("five hundred → 500", () => expect(wordsToNumber("five hundred")).toBe(500));
  it("returns null for empty string", () => expect(wordsToNumber("")).toBeNull());
  it("returns null for non-number words", () => expect(wordsToNumber("hello world")).toBeNull());
});
