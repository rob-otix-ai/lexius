// Pure helper for mapping human-readable article references to DB article IDs
// used in `derivedFrom` fields on obligations and FAQ seeds.
//
// Input forms observed in seed data:
//   - "Art. 9"
//   - "Art. 99(3)"           → drop paragraph suffix → art-99
//   - "Art. 9 and 10"        → rare, multi-match → [art-9, art-10]
//   - "Art. 9, Art. 10"      → comma separated → [art-9, art-10]
//   - "Art. 16 / Art. 17"    → slash separated → [art-16, art-17]
//   - "Annex III"            → not an article, skipped
//   - "Recital 80"           → not an article, skipped
//   - ["Art. 1", "Art. 2"]   → FAQ articleReferences array
//
// If the input doesn't parse to any article number, returns [].
// When `knownArticleIds` is supplied, unresolved IDs are filtered out so the
// `validate_derived_from` trigger cannot reject seed inserts.

// Matches either:
//   - "Art. 9"        → group 1 = "9",  group 2 = undefined
//   - "Art. 9-17"     → group 1 = "9",  group 2 = "17"  (range — expand)
//   - "Article 26"    → group 1 = "26", group 2 = undefined
const ARTICLE_NUMBER_RE = /Art(?:icle)?\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?/gi;

// Also handle "and" / "&" joining bare numbers after an article reference,
// e.g. "Art. 9 and 10"  → both 9 and 10.
// Applied per full string by walking matches and looking ahead.
const AND_TAIL_RE = /\b(?:and|&|,)\s*(\d+)\b/gi;

export function articleStringToIds(
  legislationId: string,
  raw: string | string[] | null | undefined,
  knownArticleIds?: ReadonlySet<string>,
): string[] {
  if (raw === null || raw === undefined) return [];

  const inputs = Array.isArray(raw) ? raw : [raw];
  const ids: string[] = [];
  const seen = new Set<string>();

  const push = (num: string) => {
    const id = `${legislationId}-art-${num}`;
    if (seen.has(id)) return;
    if (knownArticleIds && !knownArticleIds.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const input of inputs) {
    if (typeof input !== "string" || input.length === 0) continue;

    // First: find all "Art. N" (or "Art. N-M") occurrences.
    const matches = [...input.matchAll(ARTICLE_NUMBER_RE)];
    for (const m of matches) {
      const start = Number(m[1]);
      const end = m[2] !== undefined ? Number(m[2]) : start;
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        // Cap range size to 50 to avoid runaway ranges from typos.
        const cap = Math.min(end, start + 50);
        for (let n = start; n <= cap; n++) push(String(n));
      }
    }

    // Second: catch "Art. 9 and 10" style trailing numbers joined by
    // "and" / "&" / ","  after a primary "Art. X" match.
    if (matches.length > 0) {
      for (const tail of input.matchAll(AND_TAIL_RE)) {
        if (tail.index === undefined) continue;
        const before = input.slice(0, tail.index);
        if (/Art(?:icle)?\.?\s*\d+/i.test(before)) {
          push(tail[1]);
        }
      }
    }
  }

  return ids;
}
