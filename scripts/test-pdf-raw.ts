import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

async function main() {
  const buf = readFileSync("/tmp/cima-monetary.pdf");
  const doc = await getDocument({ data: new Uint8Array(buf.buffer) }).promise;
  console.log(`Pages: ${doc.numPages}`);

  // Check page 8 (where section text starts)
  const page = await doc.getPage(8);
  const content = await page.getTextContent();
  const items = content.items
    .filter((i: any) => "str" in i)
    .slice(0, 50);

  console.log("\nRaw text items from page 8:");
  for (const item of items) {
    const i = item as any;
    console.log(
      `  y=${Math.round(i.transform[5]).toString().padStart(3)} hasEOL=${String(i.hasEOL).padEnd(5)} "${i.str}"`
    );
  }

  // Now try extracting with EOL-aware joining
  console.log("\n\nEOL-aware text from page 8:");
  let text = "";
  for (const item of content.items) {
    const i = item as any;
    if ("str" in i) {
      text += i.str;
      if (i.hasEOL) text += "\n";
    }
  }
  const lines = text.split("\n").slice(0, 30);
  for (const l of lines) {
    console.log(`  ${l}`);
  }
}

main().catch(console.error);
