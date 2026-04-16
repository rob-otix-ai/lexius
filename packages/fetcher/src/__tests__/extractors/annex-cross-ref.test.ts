import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/annex-cross-ref.js";

describe("extractors/annex-cross-ref", () => {
  it("matches 'Annex III' without a point", () => {
    const text =
      "1. An AI system referred to in Annex III shall be considered high-risk.";
    const [row] = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    expect(row.valueText).toBe("eu-ai-act-annex-iii");
    expect(row.extractType).toBe("annex_cross_ref");
  });

  it("matches 'Annex I point 1' with a point suffix", () => {
    const text =
      "Where the high-risk AI system is covered by Annex I point 2, Article 6(1) applies.";
    const [row] = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    expect(row.valueText).toBe("eu-ai-act-annex-i-point-2");
  });

  it("deduplicates multiple references to the same annex", () => {
    const text =
      "AI systems under Annex III shall comply with obligations. Annex III lists the categories. This applies to all Annex III items.";
    const results = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    expect(results.filter((r) => r.valueText === "eu-ai-act-annex-iii")).toHaveLength(1);
  });

  it("matches multiple distinct annex references in the same text", () => {
    const text =
      "Annex I lists harmonisation legislation. Annex II lists offences. Annex III lists high-risk areas.";
    const results = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    const targets = results.map((r) => r.valueText).sort();
    expect(targets).toEqual([
      "eu-ai-act-annex-i",
      "eu-ai-act-annex-ii",
      "eu-ai-act-annex-iii",
    ]);
  });

  it("near-miss: ignores 'Annex' without a Roman numeral", () => {
    const text = "The Annex of this document is attached.";
    const results = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    expect(results).toHaveLength(0);
  });

  it("all emitted rows carry required provenance fields", () => {
    const text =
      "1. AI systems listed in Annex III shall be treated as high-risk.";
    const [row] = extract(text, "eu-ai-act-art-6", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-6");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.paragraphRef).toBe("1");
    expect(row.verbatimExcerpt).toContain("Annex III");
  });
});
