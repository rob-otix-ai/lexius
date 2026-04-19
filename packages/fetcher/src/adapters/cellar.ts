import { CellarClient } from "../cellar-client.js";
import { parseXhtml } from "../parsers/xhtml-parser.js";
import type { SourceAdapter, SourceConfig } from "./types.js";
import type { ParsedRegulation } from "../parsers/types.js";

export class CellarAdapter implements SourceAdapter {
  async fetch(config: SourceConfig): Promise<ParsedRegulation> {
    const client = new CellarClient();
    // config.url holds the CELEX number for CELLAR sources
    const { html, url } = await client.fetchXhtml(config.url);
    return parseXhtml(html, config.url, config.legislationId, url);
  }
}
