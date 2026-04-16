import type { ParsedExtract } from "./types.js";
import { inferParagraphRef, sha256, splitSentences } from "./helpers.js";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const VERBAL_DATE =
  /\b([12]?\d|3[01])\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/g;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

interface DateHit {
  date: Date;
  iso: string;
  index: number;
  raw: string;
}

function collectDates(text: string): DateHit[] {
  const hits: DateHit[] = [];
  VERBAL_DATE.lastIndex = 0;
  for (const m of text.matchAll(VERBAL_DATE)) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (Number.isNaN(day) || month === undefined || Number.isNaN(year)) continue;
    const date = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(date.getTime())) continue;
    const iso = date.toISOString().slice(0, 10);
    hits.push({ date, iso, index: m.index ?? 0, raw: m[0] });
  }
  ISO_DATE.lastIndex = 0;
  for (const m of text.matchAll(ISO_DATE)) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(date.getTime())) continue;
    const iso = date.toISOString().slice(0, 10);
    hits.push({ date, iso, index: m.index ?? 0, raw: m[0] });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * Extract `date` facts.
 *
 * Matches absolute dates in either verbal (`2 August 2026`) or ISO
 * (`2026-08-02`) form. No context filter — every date in an article is a
 * candidate. The sentence containing the date is stored verbatim.
 */
export function extract(
  text: string,
  articleId: string,
  _legislationId: string,
): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  const sentences = splitSentences(text);

  // Precompute sentence offsets to find which sentence contains each match.
  const offsets: { sentence: string; start: number; end: number }[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const idx = text.indexOf(sentence, cursor);
    if (idx < 0) continue;
    offsets.push({ sentence, start: idx, end: idx + sentence.length });
    cursor = idx + sentence.length;
  }

  for (const hit of collectDates(text)) {
    const host =
      offsets.find((o) => hit.index >= o.start && hit.index < o.end)?.sentence ?? hit.raw;
    results.push({
      articleId,
      extractType: "date",
      valueDate: hit.date,
      paragraphRef: inferParagraphRef(text, host),
      verbatimExcerpt: host.trim(),
      valueHash: sha256(`date:${hit.iso}`),
    });
  }
  return results;
}
