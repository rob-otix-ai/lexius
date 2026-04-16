import { describe, it, expect } from "vitest";
import { extract } from "../../extractors/date.js";

describe("extractors/date", () => {
  it("extracts a verbal date from EU AI Act Art. 113 prose", () => {
    const text = `Entry into force and application

This Regulation shall enter into force on the twentieth day following that of its publication in the Official Journal of the European Union.

It shall apply from 2 August 2026.`;

    const results = extract(text, "eu-ai-act-art-113", "eu-ai-act");
    const iso = results.map((r) => r.valueDate!.toISOString().slice(0, 10));
    expect(iso).toContain("2026-08-02");
  });

  it("extracts ISO-format dates", () => {
    const text = "It shall apply from 2026-08-02 onwards.";
    const [row] = extract(text, "eu-ai-act-art-113", "eu-ai-act");
    expect(row.valueDate!.toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(row.extractType).toBe("date");
  });

  it("extracts multiple dates from a compound sentence", () => {
    const text =
      "Chapter II and Article 5 shall apply from 2 February 2025. Chapter III (except Article 6(1)) and the rest shall apply from 2 August 2026. Article 6(1) shall apply from 2 August 2027.";
    const results = extract(text, "eu-ai-act-art-113", "eu-ai-act");
    const iso = results.map((r) => r.valueDate!.toISOString().slice(0, 10));
    expect(iso).toContain("2025-02-02");
    expect(iso).toContain("2026-08-02");
    expect(iso).toContain("2027-08-02");
  });

  it("near-miss: ignores non-date numbers like EUR amounts", () => {
    const text =
      "Fines shall be up to EUR 35,000,000 or 7% of turnover.";
    const results = extract(text, "eu-ai-act-art-99", "eu-ai-act");
    expect(results).toHaveLength(0);
  });

  it("near-miss: rejects invalid month-day combinations", () => {
    const text = "This is not a date: 32 January 2024.";
    const results = extract(text, "eu-ai-act-art-1", "eu-ai-act");
    // Day 32 fails the [12]?\d|3[01] regex bound — `32 January` doesn't match.
    expect(results).toHaveLength(0);
  });

  it("all emitted rows carry required provenance fields", () => {
    const text =
      "1. This Regulation shall apply from 2 August 2026.";
    const [row] = extract(text, "eu-ai-act-art-113", "eu-ai-act");
    expect(row.articleId).toBe("eu-ai-act-art-113");
    expect(row.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.paragraphRef).toBe("1");
    expect(row.verbatimExcerpt).toContain("2 August 2026");
  });
});
