#!/usr/bin/env tsx
/**
 * Test: Parse CIMA legislation PDFs in TypeScript using pdfjs-dist.
 */

import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const CIMA_PDFS = [
  {
    name: "Monetary Authority Act (2020 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf",
    id: "cima-monetary-authority",
  },
  {
    name: "Banks and Trust Companies Act (2025 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf",
    id: "cima-banks-trust",
  },
  {
    name: "Virtual Asset (Service Providers) Act (2024 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/VirtualAssetServiceProvidersAct2024Revision_1716397271.pdf",
    id: "cima-vasp",
  },
];

interface ParsedSection {
  number: string;
  title: string;
  body: string;
  sourceHash: string;
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items) {
      const it = item as any;
      if ("str" in it) {
        pageText += it.str;
        if (it.hasEOL) pageText += "\n";
      }
    }
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // Common-law pattern: "N. Title text" or "NA. Title text"
  // Split on section boundaries
  const sectionRegex = /(?:^|\n)\s*(\d+[A-Z]?)\.\s+([A-Z][^.]*?)(?:\s+\d+\.\s+|\n)/g;

  // Alternative: split by looking for "N. " patterns that start a new section
  const lines = text.split(/\n/);
  let currentNumber = "";
  let currentTitle = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    // Match section starts like "42. This section provides..."
    const match = line.match(/^\s*(\d+[A-Z]?)\.\s+(.*)/);
    if (match) {
      const num = match[1];
      const rest = match[2];

      // Heuristic: real section starts have a substantial first sentence
      // Skip TOC entries (they contain "..." or are very short)
      if (rest.includes("...") || rest.length < 10) continue;

      // Save previous section
      if (currentNumber && currentBody.length > 0) {
        const body = currentBody.join(" ").trim();
        if (body.length > 20) {
          sections.push({
            number: currentNumber,
            title: currentTitle,
            body,
            sourceHash: createHash("sha256").update(body).digest("hex"),
          });
        }
      }

      currentNumber = num;
      // Try to extract a title-like phrase from the first words
      const titleMatch = rest.match(/^([A-Z][a-z]+(?:\s+[a-z]+){0,5})/);
      currentTitle = titleMatch ? titleMatch[1] : rest.slice(0, 60);
      currentBody = [rest];
    } else if (currentNumber && line.trim()) {
      // Skip page headers/footers
      const trimmed = line.trim();
      if (
        trimmed.match(/^Page \d+/) ||
        trimmed.match(/^Revised as at/) ||
        trimmed === "c" ||
        trimmed.match(/^Section \d+/)
      ) continue;
      currentBody.push(trimmed);
    }
  }

  // Last section
  if (currentNumber && currentBody.length > 0) {
    const body = currentBody.join(" ").trim();
    if (body.length > 20) {
      sections.push({
        number: currentNumber,
        title: currentTitle,
        body,
        sourceHash: createHash("sha256").update(body).digest("hex"),
      });
    }
  }

  return sections;
}

function findPenalties(sections: ParsedSection[]): Array<{
  section: string;
  match: string;
}> {
  const results: Array<{ section: string; match: string }> = [];
  const patterns = [
    /fine\s+(?:of\s+)?(?:not exceeding\s+)?[\w\s,]+dollars/gi,
    /imprisonment\s+for\s+[\w\s]+/gi,
    /administrative\s+(?:fine|penalty)/gi,
    /\$[\d,]+/g,
    /(\d[\d,]*)\s+dollars/gi,
  ];

  for (const s of sections) {
    for (const pattern of patterns) {
      const matches = s.body.matchAll(pattern);
      for (const m of matches) {
        results.push({ section: s.number, match: m[0].trim() });
      }
    }
  }

  return results;
}

async function main() {
  for (const pdf of CIMA_PDFS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(pdf.name);
    console.log("=".repeat(70));

    console.log(`Downloading: ${pdf.url}`);
    const response = await fetch(pdf.url);
    if (!response.ok) {
      console.log(`  FAILED: ${response.status}`);
      continue;
    }
    const buffer = await response.arrayBuffer();
    console.log(`  Size: ${(buffer.byteLength / 1024).toFixed(0)} KB`);

    console.log("  Extracting text...");
    const text = await extractTextFromPdf(buffer);
    console.log(`  Text length: ${text.length} chars`);

    console.log("  Parsing sections...");
    const sections = parseSections(text);
    console.log(`  Sections found: ${sections.length}`);

    console.log("\n  First 10 sections:");
    for (const s of sections.slice(0, 10)) {
      console.log(`    s.${s.number}: ${s.title.slice(0, 50).padEnd(50)} (${s.body.length} chars)`);
    }

    const sorted = [...sections].sort((a, b) => b.body.length - a.body.length);
    console.log("\n  Largest 5 sections:");
    for (const s of sorted.slice(0, 5)) {
      console.log(`    s.${s.number}: ${s.title.slice(0, 50).padEnd(50)} (${s.body.length} chars)`);
    }

    const penalties = findPenalties(sections);
    console.log(`\n  Penalties/fines found: ${penalties.length}`);
    const unique = [...new Set(penalties.map((p) => `s.${p.section}: ${p.match}`))];
    for (const p of unique.slice(0, 10)) {
      console.log(`    ${p}`);
    }

    // Show a sample section
    const sample = sections.find((s) => s.body.length > 200 && s.body.length < 800);
    if (sample) {
      console.log(`\n  Sample section (s.${sample.number}: ${sample.title}):`);
      const preview = sample.body.slice(0, 300);
      console.log(`    ${preview.replace(/\n/g, "\n    ")}`);
    }
  }
}

main().catch(console.error);
