import type { ParsedRegulation } from "../parsers/types.js";

export interface SourceConfig {
  legislationId: string;
  url: string;
  sourceType: "cellar" | "pdf";
  jurisdiction: string; // "EU" | "KY" | "BM" | "JE" | "GG"
  sectionPrefix: string; // "art" for EU, "s" for common-law
}

export interface SourceAdapter {
  fetch(config: SourceConfig): Promise<ParsedRegulation>;
}
