import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/shall-clause.js";

describe("extractors/shall-clause", () => {
  it("matches a main-clause 'shall' sentence", () => {
    const text =
      "1. Providers shall ensure that high-risk AI systems comply with the requirements set out in this Regulation.";
    const results = extract(text, "eu-ai-act-art-16", "eu-ai-act");
    expect(results).toHaveLength(1);
    expect(results[0].valueText).toBe(results[0].verbatimExcerpt);
    expect(results[0].paragraphRef).toBe("1");
  });

  it("matches a main-clause 'must' sentence", () => {
    const text = "2. Deployers must inform workers in advance.";
    const results = extract(text, "eu-ai-act-art-26", "eu-ai-act");
    expect(results).toHaveLength(1);
    expect(results[0].verbatimExcerpt).toContain("must inform");
  });

  it("matches a 'shall not' prohibition", () => {
    const text =
      "1. Operators shall not place on the market any AI system referred to in Annex III without a conformity assessment.";
    const results = extract(text, "eu-ai-act-art-5", "eu-ai-act");
    expect(results).toHaveLength(1);
  });

  it("near-miss: skips a 'shall' inside a subordinate clause starting with 'where'", () => {
    const text =
      "An AI system where providers shall disclose training data is exempt from Article 5.";
    const results = extract(text, "eu-ai-act-art-1", "eu-ai-act");
    // The `shall` is inside a `where` subordinate — skip.
    expect(results).toHaveLength(0);
  });

  it("near-miss: skips a 'shall' after 'which'", () => {
    const text =
      "The system, which shall be monitored periodically, is deemed compliant.";
    const results = extract(text, "eu-ai-act-art-1", "eu-ai-act");
    expect(results).toHaveLength(0);
  });

  it("deduplicates identical sentences", () => {
    const text =
      "1. Providers shall maintain documentation.\n\n2. Providers shall maintain documentation.";
    const results = extract(text, "eu-ai-act-art-16", "eu-ai-act");
    expect(results).toHaveLength(1);
  });

  it("all emitted rows carry required provenance fields", () => {
    const text =
      "3. Deployers shall monitor the operation of the AI system.";
    const [row] = extract(text, "eu-ai-act-art-26", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-26");
    expect(row.extractType).toBe("shall_clause");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.paragraphRef).toBe("3");
  });

  it("ignores permissive 'may' (not a hard obligation)", () => {
    const text = "1. Member States may establish national authorities.";
    const results = extract(text, "eu-ai-act-art-70", "eu-ai-act");
    expect(results).toHaveLength(0);
  });
});
