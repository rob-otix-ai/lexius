import { logger } from "./logger.js";

export interface CellarFetchResult {
  html: string;
  url: string;
}

export class CellarClient {
  private readonly userAgent: string;

  constructor(userAgent = "lexius-fetcher/0.1 (+https://github.com/rob-otix-ai/lexius)") {
    this.userAgent = userAgent;
  }

  async fetchXhtml(celex: string): Promise<CellarFetchResult> {
    const url = `https://publications.europa.eu/resource/celex/${celex}`;
    logger.debug({ celex, url }, "Fetching from CELLAR");

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/xhtml+xml",
            "Accept-Language": "eng",
            "User-Agent": this.userAgent,
          },
          redirect: "follow",
        });

        if (response.status === 429 || response.status >= 500) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn({ status: response.status, delay }, "CELLAR retry");
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          // Non-retryable error — throw immediately without retry
          throw new Error(`CELLAR returned HTTP ${response.status} for CELEX ${celex}`);
        }

        const html = await response.text();
        logger.info({ celex, size: html.length }, "CELLAR fetch complete");
        return { html, url: response.url };
      } catch (err) {
        lastError = err as Error;
        // Only retry on network errors, not on HTTP non-ok responses
        if ((err as Error).message?.includes("CELLAR returned HTTP")) {
          throw err;
        }
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError ?? new Error("CELLAR fetch failed after 3 attempts");
  }
}
