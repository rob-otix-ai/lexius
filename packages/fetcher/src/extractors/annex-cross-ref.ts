import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, romanToInt, sha256, splitSentences } from "./helpers.js";

const ANNEX_REF = /Annex\s+([IVXL]+)(?:\s+point\s+(\d+))?/g;

/**
 * Extract `annex_cross_ref` facts.
 *
 * Matches `Annex <ROMAN>` with optional ` point N` suffix. Emits
 * `valueText = <legislationId>-annex-<lower-roman>[-point-N]`.
 */
export function extract(
  text: string,
  articleId: string,
  legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  const seen = new Set<string>();

  ANNEX_REF.lastIndex = 0;
  for (const m of text.matchAll(ANNEX_REF)) {
    const roman = m[1];
    // Validate it's actually a Roman numeral (e.g., avoid matching "I" when
    // it's a pronoun — but that can't happen after "Annex " anyway).
    if (!romanToInt(roman)) continue;
    const point = m[2];
    const lowerRoman = roman.toLowerCase();
    const valueText = point
      ? `${legislationId}-annex-${lowerRoman}-point-${point}`
      : `${legislationId}-annex-${lowerRoman}`;

    if (seen.has(valueText)) continue;
    seen.add(valueText);

    const idx = m.index ?? 0;
    const sentence = sentenceAround(text, idx);
    results.push({
      articleId,
      extractType: "annex_cross_ref",
      valueText,
      paragraphRef: inferParagraphRef(text, sentence),
      verbatimExcerpt: sentence.trim(),
      valueHash: sha256(`annex_cross_ref:${valueText}`),
    });
  }
  return results;
}

function sentenceAround(text: string, idx: number): string {
  const sentences = splitSentences(text);
  let cursor = 0;
  for (const sentence of sentences) {
    const start = text.indexOf(sentence, cursor);
    if (start < 0) continue;
    const end = start + sentence.length;
    if (idx >= start && idx < end) return sentence;
    cursor = end;
  }
  const from = Math.max(0, idx - 100);
  const to = Math.min(text.length, idx + 100);
  return text.slice(from, to);
}
