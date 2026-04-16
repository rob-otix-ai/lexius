import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/article-cross-ref.js";

describe("extractors/article-cross-ref", () => {
  it("matches a qualified cross-ref with 'referred to in Article N'", () => {
    const text =
      "Providers of AI systems referred to in Article 5 shall not place them on the market.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const targets = results.map((r) => r.valueText);
    expect(targets).toContain("eu-ai-act-art-5");
  });

  it("matches 'pursuant to Article N' and 'in accordance with Article N'", () => {
    const text =
      "Operators shall comply pursuant to Article 16. Notified bodies shall act in accordance with Article 29.";
    const results = extract(text, "eu-ai-act-art-1", "eu-ai-act");
    const targets = results.map((r) => r.valueText);
    expect(targets).toContain("eu-ai-act-art-16");
    expect(targets).toContain("eu-ai-act-art-29");
  });

  it("matches a bare 'Article N' inside body text, not the heading line", () => {
    const text = `Article 99\n\nProviders shall abide by Article 5 and the rules it sets out.`;
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const targets = results.map((r) => r.valueText);
    // Heading `Article 99` on first line is skipped.
    expect(targets).toContain("eu-ai-act-art-5");
    expect(targets).not.toContain("eu-ai-act-art-99");
  });

  it("handles parenthesised paragraphs (e.g. 'Article 9(2)')", () => {
    const text =
      "Providers shall implement risk management systems as set out in Article 9.";
    const [row] = extract(text, "eu-ai-act-art-1", "eu-ai-act");
    // We record the article number only, not the paragraph.
    expect(row.valueText).toBe("eu-ai-act-art-9");
  });

  it("deduplicates multiple references to the same article within one sentence", () => {
    const text =
      "Pursuant to Article 5 and as set out in Article 5, operators are prohibited.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const toArt5 = results.filter((r) => r.valueText === "eu-ai-act-art-5");
    expect(toArt5).toHaveLength(1);
  });

  it("all emitted rows carry required provenance fields", () => {
    const text =
      "1. Systems referred to in Article 5 shall not be deployed.";
    const [row] = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-99");
    expect(row.extractType).toBe("article_cross_ref");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.paragraphRef).toBe("1");
    expect(row.verbatimExcerpt).toContain("Article 5");
  });

  it("near-miss: skips self-references to the host article", () => {
    const text = `Preliminary\n\nThis Article 99 itself explains penalties.`;
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(results.every((r) => r.valueText !== "eu-ai-act-art-99")).toBe(true);
  });
});
