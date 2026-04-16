import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

const PENALTY_CONTEXT = /(fine|penalty|penalties|administrative)/i;
const TURNOVER_CONTEXT = /turnover/i;
const PERCENTAGE = /(\d+(?:\.\d+)?)\s*%/g;

/**
 * Extract `turnover_percentage` facts.
 *
 * Fires on a percentage figure in a sentence that mentions BOTH `turnover` and
 * a penalty-context word. The value is stored to two decimals ("7.00", "3.00",
 * "1.50") for numeric comparability.
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  for (const sentence of splitSentences(text)) {
    if (!PENALTY_CONTEXT.test(sentence)) continue;
    if (!TURNOVER_CONTEXT.test(sentence)) continue;
    PERCENTAGE.lastIndex = 0;
    for (const match of sentence.matchAll(PERCENTAGE)) {
      const raw = match[1];
      const value = parseFloat(raw);
      if (Number.isNaN(value)) continue;
      const canonical = value.toFixed(2);
      results.push({
        articleId,
        extractType: "turnover_percentage",
        valueNumeric: canonical,
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`turnover_percentage:${canonical}`),
      });
    }
  }
  return results;
}
