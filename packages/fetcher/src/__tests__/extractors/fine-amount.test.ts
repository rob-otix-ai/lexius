import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/fine-amount.js";

describe("extractors/fine-amount", () => {
  it("extracts the three fine amounts from EU AI Act Art. 99 prose", () => {
    // Based on the verbatim text of Regulation (EU) 2024/1689, Article 99.
    const text = `Penalties

1. In accordance with the terms and conditions laid down in this Regulation, Member States shall lay down the rules on penalties.

3. Non-compliance with the prohibition of the AI practices referred to in Article 5 shall be subject to administrative fines of up to EUR 35,000,000 or, if the offender is an undertaking, up to 7 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.

4. Non-compliance with any of the following provisions related to operators or notified bodies shall be subject to administrative fines of up to EUR 15,000,000 or, if the offender is an undertaking, up to 3 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.

5. The supply of incorrect, incomplete or misleading information to notified bodies or national competent authorities in reply to a request shall be subject to administrative fines of up to EUR 7,500,000 or, if the offender is an undertaking, up to 1 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.`;

    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const values = results.map((r) => r.valueNumeric);
    expect(values).toContain("35000000");
    expect(values).toContain("15000000");
    expect(values).toContain("7500000");
    expect(results).toHaveLength(3);
  });

  it("all emitted rows carry the required provenance fields", () => {
    const text =
      "3. Breaches shall be subject to administrative fines of up to EUR 35,000,000.";
    const [row] = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-99");
    expect(row.extractType).toBe("fine_amount_eur");
    expect(row.valueNumeric).toBe("35000000");
    expect(row.paragraphRef).toBe("3");
    expect(row.verbatimExcerpt).toContain("EUR 35,000,000");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("near-miss: ignores EUR figures in turnover/scope sentences", () => {
    const text =
      "For SMEs, the penalty cap is reduced where annual turnover does not exceed EUR 50 million.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    // `turnover` appears in the sentence — that's an EXCLUDES match → 0 rows.
    expect(results).toHaveLength(0);
  });

  it("near-miss: ignores EUR figures outside penalty context", () => {
    const text =
      "The market for compliance services grew to EUR 100,000,000 in 2025.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(results).toHaveLength(0);
  });

  it("handles 'EUR 7.5 million' magnitude shorthand", () => {
    const text =
      "3. Non-compliance incurs an administrative fine of up to EUR 7.5 million.";
    const [row] = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(row.valueNumeric).toBe("7500000");
  });

  it("handles compound sentences with multiple fines", () => {
    const text =
      "3. Violations of Article 5 shall be subject to administrative fines of up to EUR 35,000,000 or, in the case of an undertaking, EUR 15,000,000.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const values = results.map((r) => r.valueNumeric).sort();
    expect(values).toEqual(["15000000", "35000000"]);
  });
});
