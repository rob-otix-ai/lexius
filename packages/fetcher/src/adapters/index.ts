import type { SourceConfig, SourceAdapter } from "./types.js";
import { CellarAdapter } from "./cellar.js";
import { PdfAdapter } from "./pdf.js";

export type { SourceConfig, SourceAdapter } from "./types.js";
export { CellarAdapter } from "./cellar.js";
export { PdfAdapter } from "./pdf.js";

export function createAdapter(config: SourceConfig): SourceAdapter {
  switch (config.sourceType) {
    case "cellar":
      return new CellarAdapter();
    case "pdf":
      return new PdfAdapter();
    default:
      throw new Error(`Unknown source type: ${(config as SourceConfig).sourceType}`);
  }
}
