import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseSections } from "../parsers/section-parser.js";
import type { SourceAdapter, SourceConfig } from "./types.js";
import type { ParsedRegulation } from "../parsers/types.js";
import { logger } from "../logger.js";

export class PdfAdapter implements SourceAdapter {
  async fetch(config: SourceConfig): Promise<ParsedRegulation> {
    logger.info({ url: config.url }, "Downloading PDF");
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(
        `PDF download failed: ${response.status} for ${config.url}`,
      );
    }

    const buffer = await response.arrayBuffer();
    const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;

    logger.info({ pages: doc.numPages }, "Extracting text from PDF");

    // Extract text with EOL-aware joining
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

    const fullText = pages.join("\n\n");
    const sections = parseSections(fullText);

    logger.info(
      { legislationId: config.legislationId, sections: sections.length },
      "PDF parsed",
    );

    return {
      celex: "",
      legislationId: config.legislationId,
      sourceUrl: config.url,
      sourceFormat: "pdf",
      articles: sections,
      fetchedAt: new Date(),
    };
  }
}
