export interface ParsedArticle {
  number: string;
  title: string;
  body: string;
  sourceHash: string;
}

export interface ParsedRegulation {
  celex: string;
  legislationId: string;
  sourceUrl: string;
  sourceFormat: "xhtml" | "fmx4" | "pdf";
  articles: ParsedArticle[];
  fetchedAt: Date;
}
