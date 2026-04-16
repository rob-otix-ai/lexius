import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

const QUALIFIED_REF =
  /(?:referred to in|under|pursuant to|as set out in|in accordance with|laid down in)\s+Article\s+(\d+[a-z]?)/gi;
const BARE_ARTICLE_REF = /Article\s+(\d+[a-z]?)/g;

/**
 * Extract `article_cross_ref` facts.
 *
 * Matches two kinds of references:
 * - Qualified refs: "as referred to in Article N", "pursuant to Article N", etc.
 * - Bare refs: any `Article N` found in the body text — except when it sits in
 *   the first line (the article's own heading).
 *
 * Emits `valueText = <legislationId>-art-<N>` (with `N` lowercased).
 */
export function extract(
  text: string,
  articleId: string,
  legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  const seenPerSentence = new Map<string, Set<string>>();

  // First pass: qualified references. Always emit (even if in the first line —
  // qualified refs are rarely in headings, and if they are, that's fine).
  QUALIFIED_REF.lastIndex = 0;
  for (const m of text.matchAll(QUALIFIED_REF)) {
    const idx = m.index ?? 0;
    const target = m[1].toLowerCase();
    const sentence = sentenceAround(text, idx);
    const key = `${sentence}|${target}`;
    if (!seenPerSentence.has(sentence)) seenPerSentence.set(sentence, new Set());
    const set = seenPerSentence.get(sentence)!;
    if (set.has(target)) continue;
    set.add(target);
    emit(results, articleId, legislationId, target, sentence, text);
  }

  // Second pass: bare "Article N" inside sentences, excluding the first line
  // (the article's own heading).
  const firstLineEnd = text.indexOf("\n");
  const headingRegion = firstLineEnd < 0 ? text.length : firstLineEnd;

  BARE_ARTICLE_REF.lastIndex = 0;
  for (const m of text.matchAll(BARE_ARTICLE_REF)) {
    const idx = m.index ?? 0;
    if (idx < headingRegion) continue;
    const target = m[1].toLowerCase();
    // Skip references pointing at the host article itself.
    if (`${legislationId}-art-${target}` === articleId) continue;
    const sentence = sentenceAround(text, idx);
    if (!seenPerSentence.has(sentence)) seenPerSentence.set(sentence, new Set());
    const set = seenPerSentence.get(sentence)!;
    if (set.has(target)) continue;
    set.add(target);
    emit(results, articleId, legislationId, target, sentence, text);
  }

  return results;
}

function emit(
  results: ParsedExtract[],
  articleId: string,
  legislationId: string,
  target: string,
  sentence: string,
  fullText: string,
): void {
  const valueText = `${legislationId}-art-${target}`;
  results.push({
    articleId,
    extractType: "article_cross_ref",
    valueText,
    paragraphRef: inferParagraphRef(fullText, sentence),
    verbatimExcerpt: sentence.trim(),
    valueHash: sha256(`article_cross_ref:${valueText}`),
  });
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
  // Fall back to a 200-char window.
  const from = Math.max(0, idx - 100);
  const to = Math.min(text.length, idx + 100);
  return text.slice(from, to);
}
