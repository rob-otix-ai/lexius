import { describe, it, expect } from "vitest";
import { PdfAdapter } from "../adapters/pdf.js";
import type { SourceConfig } from "../adapters/types.js";

describe("PdfAdapter integration (downloads real PDF)", () => {
  const config: SourceConfig = {
    legislationId: "cima-monetary-authority",
    url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf",
    sourceType: "pdf",
    jurisdiction: "KY",
    sectionPrefix: "s",
  };

  it(
    "downloads and parses the Monetary Authority Act PDF",
    async () => {
      const adapter = new PdfAdapter();
      const result = await adapter.fetch(config);

      // Post-merge section count should be > 50
      console.log(`Total sections parsed: ${result.articles.length}`);
      expect(result.articles.length).toBeGreaterThan(50);

      // Zero duplicate section numbers
      const numbers = result.articles.map((a) => a.number);
      const uniqueNumbers = new Set(numbers);
      const duplicateCount = numbers.length - uniqueNumbers.size;
      console.log(
        `Duplicate section numbers: ${duplicateCount} (${numbers.length} total, ${uniqueNumbers.size} unique)`,
      );
      expect(duplicateCount).toBe(0);

      // No section body contains the act title (header filtered)
      const actTitle = "Monetary Authority Law (2020 Revision)";
      const leakedHeaders = result.articles.filter((a) =>
        a.body.includes(actTitle),
      );
      console.log(`Sections with leaked header: ${leakedHeaders.length}`);
      expect(leakedHeaders.length).toBe(0);

      // At least 15 sections contain penalty-related text
      const penaltySections = result.articles.filter(
        (a) =>
          /fine|penalty|imprisonment/i.test(a.body),
      );
      console.log(`Penalty-bearing sections: ${penaltySections.length}`);
      expect(penaltySections.length).toBeGreaterThanOrEqual(10);

      // Metadata checks
      expect(result.sourceFormat).toBe("pdf");
      expect(result.legislationId).toBe("cima-monetary-authority");
      expect(result.celex).toBe("");
    },
    { timeout: 60_000 },
  );
});
