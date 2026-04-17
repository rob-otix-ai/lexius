import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { ParsedArticle, ParsedRegulation } from "./types.js";
import { logger } from "../logger.js";

const ARTICLE_TITLE_SELECTOR = "p.oj-ti-art";
const ARTICLE_SUBTITLE_SELECTOR = "p.oj-sti-art";
const ANNEX_TITLE_SELECTOR = "p.oj-doc-ti";

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

  // Parse annexes — tagged with class="oj-doc-ti" containing "ANNEX"
  const annexTitles = $(ANNEX_TITLE_SELECTOR).filter((_i, el) =>
    /ANNEX[\s\u00a0]/i.test($(el).text()),
  );

  annexTitles.each((_i, el) => {
    const titleEl = $(el);
    const titleText = titleEl.text().replace(/\u00a0/g, " ").trim();
    const match = titleText.match(/^ANNEX\s+([IVXLC]+(?:\s*[A-Z])?)/i);
    if (!match) return;
    const romanNumeral = match[1].trim();
    const number = `annex-${romanNumeral.toLowerCase()}`;

    // Subtitle is the next paragraph (usually the annex's descriptive title)
    const subTitleEl = titleEl.next("p");
    const subTitle = subTitleEl.length ? subTitleEl.text().replace(/\s+/g, " ").trim() : "";

    // Body: walk siblings until the next oj-doc-ti (next annex heading) or end
    const bodyParts: string[] = [];
    let current = subTitleEl.length ? subTitleEl.next() : titleEl.next();
    while (current.length && !current.hasClass("oj-doc-ti")) {
      const text = current.text().replace(/\s+/g, " ").trim();
      if (text) bodyParts.push(text);
      current = current.next();
    }

    const body = bodyParts.join("\n\n");
    if (!body) {
      logger.debug({ number }, "Empty annex body, skipping");
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

  logger.info(
    { celex, articleCount: articles.length, annexCount: annexTitles.length },
    "XHTML parsed",
  );

  return {
    celex,
    legislationId,
    sourceUrl,
    sourceFormat: "xhtml",
    articles,
    fetchedAt: new Date(),
  };
}
