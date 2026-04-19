import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

/**
 * Matches "imprisonment for <term>" where <term> is a word-form duration
 * like "two years", "six months", "one year".
 *
 * The lazy `[\w\s]+?` captures as little as possible before hitting
 * a sentence boundary (period, comma, semicolon, or " and ").
 */
const IMPRISONMENT =
  /imprisonment\s+for\s+([\w\s]+?)(?:\.|,|;|\s+and\s)/gi;

/**
 * Extract `imprisonment_term` facts.
 *
 * Matches sentences containing "imprisonment for <duration>" and emits
 * the duration as `valueText`.
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];

  for (const sentence of splitSentences(text)) {
    IMPRISONMENT.lastIndex = 0;
    for (const match of sentence.matchAll(IMPRISONMENT)) {
      const term = match[1].trim();
      if (!term || term.split(/\s+/).length > 6) continue; // sanity cap
      results.push({
        articleId,
        extractType: "imprisonment_term",
        valueText: term,
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`imprisonment_term:${term}`),
      });
    }
  }

  return results;
}
