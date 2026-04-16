import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/turnover-percentage.js";

describe("extractors/turnover-percentage", () => {
  it("extracts the three turnover percentages from EU AI Act Art. 99 prose", () => {
    const text = `Penalties

3. Non-compliance with the prohibition of the AI practices referred to in Article 5 shall be subject to administrative fines of up to EUR 35,000,000 or, if the offender is an undertaking, up to 7 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.

4. Non-compliance with any of the following provisions shall be subject to administrative fines of up to EUR 15,000,000 or, if the offender is an undertaking, up to 3 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.

5. The supply of incorrect information shall be subject to administrative fines of up to EUR 7,500,000 or, if the offender is an undertaking, up to 1 % of its total worldwide annual turnover for the preceding financial year, whichever is higher.`;

    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    const values = results.map((r) => r.valueNumeric);
    expect(values).toContain("7.00");
    expect(values).toContain("3.00");
    expect(values).toContain("1.00");
  });

  it("canonicalises percentages to two decimals", () => {
    const text =
      "3. Breaches shall incur an administrative fine of up to 1.5 % of the undertaking's worldwide annual turnover.";
    const [row] = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(row.valueNumeric).toBe("1.50");
    expect(row.extractType).toBe("turnover_percentage");
  });

  it("near-miss: percentage without turnover context is ignored", () => {
    const text = "The market grew by 5% in 2025.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(results).toHaveLength(0);
  });

  it("near-miss: turnover without penalty context is ignored", () => {
    const text =
      "Member States shall establish that their annual turnover is monitored at 2%.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    // No fine/penalty/administrative word → 0 rows.
    expect(results).toHaveLength(0);
  });

  it("all emitted rows carry required provenance fields", () => {
    const text =
      "3. Violations shall be subject to administrative fines of up to 7 % of worldwide annual turnover.";
    const [row] = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-99");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.paragraphRef).toBe("3");
    expect(row.verbatimExcerpt).toContain("7 %");
  });
});
