import type { ExtractorFn, ParsedExtract } from "./types.js";
import { extract as fineAmount } from "./fine-amount.js";
import { extract as fineAmountKyd } from "./fine-amount-kyd.js";
import { extract as turnoverPercentage } from "./turnover-percentage.js";
import { extract as date } from "./date.js";
import { extract as articleCrossRef } from "./article-cross-ref.js";
import { extract as annexCrossRef } from "./annex-cross-ref.js";
import { extract as shallClause } from "./shall-clause.js";
import { extract as imprisonment } from "./imprisonment.js";

export type { ParsedExtract, ExtractorFn } from "./types.js";

const EXTRACTORS: ExtractorFn[] = [
  fineAmount,
  fineAmountKyd,
  turnoverPercentage,
  date,
  articleCrossRef,
  annexCrossRef,
  shallClause,
  imprisonment,
];

export function runAllExtractors(
  text: string,
  articleId: string,
  legislationId: string,
): ParsedExtract[] {
  return EXTRACTORS.flatMap((fn) => fn(text, articleId, legislationId));
}
