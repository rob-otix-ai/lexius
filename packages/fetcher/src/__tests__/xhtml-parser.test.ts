import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { parseXhtml } from "../parsers/xhtml-parser.js";

const FIXTURE_HTML = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Regulation fixture</title></head>
<body>
<p class="oj-ti-art">Article 1</p>
<p class="oj-sti-art">Subject matter</p>
<p class="oj-normal">This Regulation lays down harmonised rules on AI systems.</p>
<p class="oj-normal">It applies across all Member States.</p>

<p class="oj-ti-art">Article 2</p>
<p class="oj-sti-art">Scope</p>
<p class="oj-normal">This Regulation applies to providers and deployers.</p>

<p class="oj-ti-art">Article 3a</p>
<p class="oj-sti-art">Definitions</p>
<p class="oj-normal">For the purposes of this Regulation, the following definitions apply.</p>
<p class="oj-normal">'AI system' means a machine-based system.</p>

<p class="oj-ti-art">Article 99</p>
<p class="oj-sti-art">Empty article</p>
</body>
</html>`;

describe("parseXhtml", () => {
  it("extracts article numbers correctly (including suffixed like 3a)", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    const numbers = result.articles.map((a) => a.number);
    expect(numbers).toEqual(["1", "2", "3a"]);
  });

  it("extracts the sub-title as the article title when present", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    expect(result.articles[0].title).toBe("Subject matter");
    expect(result.articles[1].title).toBe("Scope");
    expect(result.articles[2].title).toBe("Definitions");
  });

  it("extracts the article body joined by double newlines", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    expect(result.articles[0].body).toBe(
      "This Regulation lays down harmonised rules on AI systems.\n\nIt applies across all Member States.",
    );
    expect(result.articles[1].body).toBe("This Regulation applies to providers and deployers.");
  });

  it("skips articles with empty body", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    expect(result.articles.find((a) => a.number === "99")).toBeUndefined();
  });

  it("produces a deterministic sha256 hash of the body", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    const expected = createHash("sha256").update(result.articles[0].body).digest("hex");
    expect(result.articles[0].sourceHash).toBe(expected);
    expect(result.articles[0].sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns regulation metadata alongside articles", () => {
    const result = parseXhtml(FIXTURE_HTML, "32024R1689", "eu-ai-act", "https://example.test/x");
    expect(result.celex).toBe("32024R1689");
    expect(result.legislationId).toBe("eu-ai-act");
    expect(result.sourceUrl).toBe("https://example.test/x");
    expect(result.sourceFormat).toBe("xhtml");
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });
});
