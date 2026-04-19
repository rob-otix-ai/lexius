/**
 * Extractor modules are pure — they must not reach into `@lexius/db` at
 * compile or run time. The enum values below are a verbatim copy of the
 * `extract_type` pgEnum in packages/db/src/schema/enums.ts; if that enum
 * changes, this mirror must change too. A test in extract-runner verifies
 * both lists stay in sync.
 */
export type ExtractType =
  | "fine_amount_eur"
  | "fine_amount_kyd"
  | "turnover_percentage"
  | "date"
  | "article_cross_ref"
  | "annex_cross_ref"
  | "shall_clause"
  | "annex_item"
  | "imprisonment_term";

export interface ParsedExtract {
  articleId: string;
  extractType: ExtractType;
  valueNumeric?: string;
  valueText?: string;
  valueDate?: Date;
  paragraphRef: string;
  verbatimExcerpt: string;
  valueHash: string;
}

export type ExtractorFn = (
  text: string,
  articleId: string,
  legislationId: string,
) => ParsedExtract[];
