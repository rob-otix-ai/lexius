import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { ParsedArticle, ParsedRegulation } from "./types.js";
import { logger } from "../logger.js";

const ARTICLE_TITLE_SELECTOR = "p.oj-ti-art";
const ARTICLE_SUBTITLE_SELECTOR = "p.oj-sti-art";

export function parseXhtml(
  html: string,
  celex: string,
  legislationId: string,
  sourceUrl: string,
): ParsedRegulation {
  const $ = load(html);
  const articles: ParsedArticle[] = [];

  $(ARTICLE_TITLE_SELECTOR).each((_i, el) => {
    const titleEl = $(el);
    const titleText = titleEl.text().trim();
    // EUR-Lex uses non-breaking space (U+00A0) between "Article" and the number
    const match = titleText.match(/Article[\s\u00a0]+(\d+[a-z]?)/i);
    if (!match) return;
    const number = match[1];

    const subTitleEl = titleEl.nextAll(ARTICLE_SUBTITLE_SELECTOR).first();
    const subTitle = subTitleEl.text().trim();

    const bodyParts: string[] = [];
    let current = subTitleEl.length ? subTitleEl.next() : titleEl.next();
    while (current.length && !current.hasClass("oj-ti-art")) {
      if (!current.hasClass("oj-sti-art")) {
        const text = current.text().replace(/\s+/g, " ").trim();
        if (text) bodyParts.push(text);
      }
      current = current.next();
    }

    const body = bodyParts.join("\n\n");
    if (!body) {
      logger.debug({ number }, "Empty body, skipping article");
      return;
    }

    const hash = createHash("sha256").update(body).digest("hex");

    articles.push({
      number,
      title: subTitle || titleText,
      body,
      sourceHash: hash,
    });
  });

  logger.info({ celex, articleCount: articles.length }, "XHTML parsed");

  return {
    celex,
    legislationId,
    sourceUrl,
    sourceFormat: "xhtml",
    articles,
    fetchedAt: new Date(),
  };
}
