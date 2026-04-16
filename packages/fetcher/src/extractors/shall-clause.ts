import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

const TRIGGERS = [
  "shall not",
  "may not",
  "must not",
  "shall",
  "must",
  "may",
];

/**
 * Extract `shall_clause` facts — obligation sentences.
 *
 * Fires on a sentence whose main verb is `shall` / `must` / (`shall|may|must`)`
 * not`. A trigger inside a subordinate clause (the word appears AFTER a
 * subordinator like "which", "where", "if", "when") does not count — we want
 * the main clause to be the obligation.
 *
 * `may` on its own is NOT a hard obligation but IS a permission — we skip it
 * here; permissions can be added as a separate extract type later.
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  const seen = new Set<string>();

  for (const sentence of splitSentences(text)) {
    const trigger = firstTrigger(sentence);
    if (!trigger) continue;
    if (trigger === "may") continue; // permissive, not obligation

    const canonical = sentence.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    results.push({
      articleId,
      extractType: "shall_clause",
      valueText: sentence.trim(),
      paragraphRef: inferParagraphRef(text, sentence),
      verbatimExcerpt: sentence.trim(),
      valueHash: sha256(`shall_clause:${canonical}`),
    });
  }
  return results;
}

/**
 * Returns the main-clause trigger word, or null if the only triggers in the
 * sentence sit inside a subordinate clause.
 *
 * Heuristic: scan the sentence in order; find the first trigger; if it is
 * preceded by a subordinator (`which`, `where`, `if`, `when`) on the same
 * side of any comma boundary, reject.
 */
function firstTrigger(sentence: string): string | null {
  const lower = sentence.toLowerCase();
  // Find earliest trigger occurrence.
  let earliest: { trigger: string; index: number } | null = null;
  for (const t of TRIGGERS) {
    const idx = lower.indexOf(` ${t} `);
    if (idx < 0) continue;
    if (earliest === null || idx < earliest.index) {
      earliest = { trigger: t, index: idx };
    }
  }
  if (!earliest) return null;

  // Look back from the trigger to the previous comma (or start of sentence).
  // If a subordinator is present in that slice, the trigger is inside a
  // subordinate clause.
  const sliceStart = Math.max(
    lower.lastIndexOf(",", earliest.index),
    lower.lastIndexOf(";", earliest.index),
    -1,
  );
  const clause = lower.slice(sliceStart + 1, earliest.index);
  if (/\b(which|where|if|when)\b/.test(clause)) {
    return null;
  }
  return earliest.trigger;
}
