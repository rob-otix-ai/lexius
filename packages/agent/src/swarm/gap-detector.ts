import type { GapFinding } from "./types.js";

interface ShallClause {
  id: number;
  articleId: string;
  valueText: string | null;
  verbatimExcerpt: string;
}

interface CuratedObligation {
  id: string;
  obligation: string;
}

/**
 * P0 gap detection: text overlap matching (no embeddings, no LLM calls).
 *
 * For each shall-clause, checks if any curated obligation contains the first
 * 50 chars of the clause text (case-insensitive), or vice versa.
 * If no match, emits a GapFinding.
 */
export function detectGaps(
  shallClauses: ShallClause[],
  curatedObligations: CuratedObligation[],
  threshold?: number,
): GapFinding[] {
  const gaps: GapFinding[] = [];

  for (const clause of shallClauses) {
    if (!clause.valueText) continue;

    const clauseSnippet = clause.valueText.toLowerCase().slice(0, 50);

    const matched = curatedObligations.some(
      (o) =>
        o.obligation.toLowerCase().includes(clauseSnippet) ||
        clause.valueText!.toLowerCase().includes(
          o.obligation.toLowerCase().slice(0, 50),
        ),
    );

    if (!matched) {
      gaps.push({
        type: "gap",
        shallClauseText: clause.valueText,
        shallClauseId: clause.id,
        articleRef: clause.articleId,
        reason:
          "No curated obligation matches this verbatim legal requirement",
      });
    }
  }

  return gaps;
}
