import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

const FINE_CONTEXT = /(fine|penalty|penalties|liable)/i;

/** Numeric dollar amounts: "5,000 dollars", "100,000 dollars" */
const DOLLAR_NUMERIC = /(\d[\d,]*)\s+dollars/gi;

/**
 * Word-to-number map. Covers the minimum set required by DDD-015:
 * one, two, three, five, ten, twenty, fifty, hundred, thousand, million.
 */
const WORD_VALUES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
};

/**
 * Convert a word-form number phrase to a numeric value.
 *
 * Handles compound phrases like "one hundred thousand", "ten thousand",
 * "fifty thousand", "one million". Uses a simple accumulator pattern:
 * - "hundred" / "thousand" / "million" multiply the current group
 * - smaller words add to the current group
 *
 * Examples:
 *   "ten thousand" → 10000
 *   "one hundred thousand" → 100000
 *   "fifty thousand" → 50000
 *   "one million" → 1000000
 */
export function wordsToNumber(phrase: string): number | null {
  const words = phrase
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((w) => w in WORD_VALUES);

  if (words.length === 0) return null;

  let total = 0;
  let current = 0;

  for (const word of words) {
    const val = WORD_VALUES[word];
    if (val === 1_000_000) {
      // million multiplies everything accumulated so far
      current = current === 0 ? 1 : current;
      total += current * 1_000_000;
      current = 0;
    } else if (val === 1_000) {
      current = current === 0 ? 1 : current;
      total += current * 1_000;
      current = 0;
    } else if (val === 100) {
      current = current === 0 ? 1 : current;
      current *= 100;
    } else {
      current += val;
    }
  }

  total += current;
  return total > 0 ? total : null;
}

/** Word-form dollar amounts: "ten thousand dollars", "one hundred thousand dollars" */
const DOLLAR_WORDS =
  /((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)[\s-]*)+)\s+dollars/gi;

/**
 * Extract `fine_amount_kyd` facts from Cayman Islands legislation.
 *
 * A match fires when a sentence contains a fine/penalty/liable context word
 * AND a dollar amount (numeric or word-form).
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];

  for (const sentence of splitSentences(text)) {
    if (!FINE_CONTEXT.test(sentence)) continue;

    // Numeric dollar amounts
    DOLLAR_NUMERIC.lastIndex = 0;
    for (const match of sentence.matchAll(DOLLAR_NUMERIC)) {
      const digits = match[1].replace(/,/g, "");
      const value = parseInt(digits, 10);
      if (Number.isNaN(value) || value === 0) continue;
      results.push({
        articleId,
        extractType: "fine_amount_kyd",
        valueNumeric: value.toString(),
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`fine_amount_kyd:${value}`),
      });
    }

    // Word-form dollar amounts
    DOLLAR_WORDS.lastIndex = 0;
    for (const match of sentence.matchAll(DOLLAR_WORDS)) {
      const value = wordsToNumber(match[1]);
      if (value === null) continue;
      results.push({
        articleId,
        extractType: "fine_amount_kyd",
        valueNumeric: value.toString(),
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`fine_amount_kyd:${value}`),
      });
    }
  }

  return results;
}
