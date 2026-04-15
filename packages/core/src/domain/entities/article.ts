export interface Article {
  id: string;
  legislationId: string;
  number: string;
  title: string;
  summary: string;
  fullText: string;
  sourceUrl: string | null;
  relatedAnnexes: string[];
}
