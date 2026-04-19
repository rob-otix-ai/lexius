import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/imprisonment.js";

describe("extractors/imprisonment", () => {
  it("extracts 'imprisonment for two years'", () => {
    const text =
      "A person convicted of an offence is liable to imprisonment for two years.";
    const results = extract(text, "cima-test-s1", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].extractType).toBe("imprisonment_term");
    expect(results[0].valueText).toBe("two years");
  });

  it("extracts 'imprisonment for six months'", () => {
    const text =
      "On summary conviction, a person is liable to imprisonment for six months, or a fine.";
    const results = extract(text, "cima-test-s2", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueText).toBe("six months");
  });

  it("extracts 'imprisonment for one year'", () => {
    const text =
      "The offender shall be liable to imprisonment for one year and a fine of ten thousand dollars.";
    const results = extract(text, "cima-test-s3", "cima-test");
    expect(results).toHaveLength(1);
    expect(results[0].valueText).toBe("one year");
  });

  it("does not match text without imprisonment keyword", () => {
    const text =
      "A person shall serve a term of two years in community service.";
    const results = extract(text, "cima-test-s4", "cima-test");
    expect(results).toHaveLength(0);
  });

  it("all emitted rows carry the required provenance fields", () => {
    const text =
      "A person convicted is liable to imprisonment for three years.";
    const [row] = extract(text, "cima-test-s5", "cima-test");
    expect(row.articleId).toBe("cima-test-s5");
    expect(row.extractType).toBe("imprisonment_term");
    expect(row.valueText).toBe("three years");
    expect(row.verbatimExcerpt).toContain("imprisonment for three years");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
