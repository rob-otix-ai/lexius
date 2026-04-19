import { describe, it, expect } from "vitest";
import { parseSections } from "../parsers/section-parser.js";

describe("section-parser", () => {
  it("Test 1: parses basic sections correctly", () => {
    const text = [
      "CAYMAN ISLANDS",
      "",
      "Some Act (2020 Revision)",
      "",
      "1. Short title and commencement",
      "1. This Act may be cited as the Some Act (2020 Revision) and shall come into force on the date appointed.",
      "",
      "2. Interpretation and definitions",
      "2. In this Act, unless the context otherwise requires, the following terms have the meanings given below.",
      "",
      "3. Application of the Act to all regulated entities",
      "3. This Act applies to all entities that are regulated under the laws of the Cayman Islands.",
    ].join("\n");

    const sections = parseSections(text);
    expect(sections.length).toBe(3);

    expect(sections[0].number).toBe("1");
    expect(sections[0].title).toBe("Short title and commencement");
    expect(sections[0].body).toContain("This Act may be cited");

    expect(sections[1].number).toBe("2");
    expect(sections[1].title).toBe("Interpretation and definitions");

    expect(sections[2].number).toBe("3");
    expect(sections[2].title).toBe("Application of the Act to all regulated entities");
    expect(sections[2].body).toContain("This Act applies to all entities");
  });

  it("Test 2: merges title/body duplicate section numbers", () => {
    const text = [
      "CAYMAN ISLANDS",
      "",
      "Some Act (2020 Revision)",
      "",
      "3. Determination of fitness and propriety",
      "3. In determining for the purposes of this Act whether a person is fit and proper, regard shall be had to all circumstances including financial standing and character.",
    ].join("\n");

    const sections = parseSections(text);
    expect(sections.length).toBe(1);
    expect(sections[0].number).toBe("3");
    expect(sections[0].title).toBe("Determination of fitness and propriety");
    expect(sections[0].body).toContain("In determining");
  });

  it("Test 3: dynamic header detection filters act title from section bodies", () => {
    // Simulate a real CIMA PDF where the act title leaks as a page header
    // between sections. Page 1 has "CAYMAN ISLANDS" and the act title on the
    // same page (single newlines). The \n\n separates "pages" as PdfAdapter does.
    // Subsequent pages have the act title as a leaked header.
    const text = [
      // Page 1 (single newlines within page)
      "CAYMAN ISLANDS\nMonetary Authority Law (2020 Revision)\nTable of Contents",
      "",
      // Page 2 — header leaks
      "Monetary Authority Law (2020 Revision)",
      "1. Short title for this legislation",
      "1. This Act may be cited as the Some Law and shall come into force immediately upon publication.",
      "",
      // Page 3 — header leaks into section 2's body area
      "Monetary Authority Law (2020 Revision)",
      "2. Interpretation of terms used in this Act",
      "2. In this Act the following terms and expressions shall have the meanings assigned to them herein.",
      "The regulator may issue guidance from time to time.",
      // Another page break header leak inside section 2 body
      "Monetary Authority Law (2020 Revision)",
      "Any guidance issued must be published in the Gazette.",
      "",
      // Page 4
      "Monetary Authority Law (2020 Revision)",
      "3. Powers of the Authority under section three",
      "3. The Authority shall have the power to supervise and regulate financial services in the Cayman Islands.",
    ].join("\n");

    const sections = parseSections(text);
    // The act title (which appears as page header) should not appear in any section body
    for (const section of sections) {
      expect(section.body).not.toContain(
        "Monetary Authority Law (2020 Revision)",
      );
    }
    expect(sections.length).toBe(3);
  });

  it("Test 4: accepts huge definitions section (15K chars)", () => {
    // Generate a 15K char definitions section
    const definitions: string[] = [];
    for (let i = 0; i < 300; i++) {
      definitions.push(
        `"term${i}" means a definition that describes concept number ${i} in significant detail;`,
      );
    }
    const bigBody = definitions.join("\n");

    const text = [
      "CAYMAN ISLANDS",
      "",
      "Some Act (2020 Revision)",
      "",
      "2. Interpretation and important definitions",
      `2. In this Act— ${bigBody}`,
    ].join("\n");

    const sections = parseSections(text);
    expect(sections.length).toBe(1);
    expect(sections[0].number).toBe("2");
    expect(sections[0].body.length).toBeGreaterThan(10000);
  });

  it("Test 5: skips TOC entries containing '......'", () => {
    const text = [
      "CAYMAN ISLANDS",
      "",
      "Some Act (2020 Revision)",
      "",
      "1. Short title........................................... 3",
      "2. Interpretation........................................ 4",
      "3. Application........................................... 8",
      "",
      "1. Short title and commencement provisions",
      "1. This Act may be cited as the Some Act (2020 Revision) and shall come into force on the date appointed.",
    ].join("\n");

    const sections = parseSections(text);
    expect(sections.length).toBe(1);
    expect(sections[0].number).toBe("1");
    expect(sections[0].body).not.toContain("......");
  });

  it("Test 6: skips page headers (Page N, Revised as at, c)", () => {
    const text = [
      "CAYMAN ISLANDS",
      "",
      "Some Act (2020 Revision)",
      "",
      "1. Short title and commencement provisions",
      "1. This Act may be cited as the Some Act (2020 Revision) and shall come into force on the date appointed.",
      "Page 8",
      "Revised as at 31st December, 2019",
      "c",
      "The Authority shall have supervisory powers and obligations under this legislation.",
    ].join("\n");

    const sections = parseSections(text);
    expect(sections.length).toBe(1);
    // None of the page headers should appear in the section body
    expect(sections[0].body).not.toContain("Page 8");
    expect(sections[0].body).not.toContain("Revised as at");
    expect(sections[0].body).not.toContain("\nc\n");
  });
});
