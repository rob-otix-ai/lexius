export interface ArticleExtract {
  id: number;
  articleId: string;
  extractType:
    | "fine_amount_eur"
    | "fine_amount_kyd"
    | "turnover_percentage"
    | "date"
    | "article_cross_ref"
    | "annex_cross_ref"
    | "shall_clause"
    | "annex_item"
    | "imprisonment_term";
  valueNumeric: string | null;
  valueText: string | null;
  valueDate: Date | null;
  paragraphRef: string;
  verbatimExcerpt: string;
  sourceHash: string;
  extractedAt: Date;
}
