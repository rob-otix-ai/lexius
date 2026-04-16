import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, normaliseEur, sha256, splitSentences } from "./helpers.js";

const FINE_CONTEXT = /(fine|penalty|penalties|administrative)/i;
// Phrases that indicate a EUR figure is describing scope / size thresholds
// rather than a punitive amount. Kept narrow — a generic `turnover` mention
// is fine because Art. 99's own fine clauses say "up to EUR 35M or 7 % of
// worldwide turnover".
const SCOPE_EXCLUDES =
  /(turnover (?:exceeding|of at least|below|above|greater than|less than|does not exceed|not exceed(?:ing)?)|revenue (?:exceeding|of at least|below|above|does not exceed|not exceed(?:ing)?)|worth (?:of|exceeding)|threshold of|cap is reduced)/i;
const EUR_AMOUNT =
  /(?:EUR|€)\s*([\d]+(?:[\s,\.][\d]+)*)\s*(million|billion|thousand|m|bn)?/gi;

/**
 * Extract `fine_amount_eur` facts.
 *
 * A match fires when a sentence contains a fine/penalty/administrative context
 * word AND a EUR/€ amount. Sentences using threshold/scope phrasing
 * (e.g. "turnover exceeding EUR 50 million", "worth of EUR 10 million") are
 * excluded — those reference scope, not the punitive amount.
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  for (const sentence of splitSentences(text)) {
    if (!FINE_CONTEXT.test(sentence)) continue;
    if (SCOPE_EXCLUDES.test(sentence)) continue;
    EUR_AMOUNT.lastIndex = 0;
    for (const match of sentence.matchAll(EUR_AMOUNT)) {
      const normalised = normaliseEur(match[1], match[2]);
      if (normalised === null) continue;
      results.push({
        articleId,
        extractType: "fine_amount_eur",
        valueNumeric: normalised.toString(),
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`fine_amount_eur:${normalised}`),
      });
    }
  }
  return results;
}
