export interface ArticleRevision {
  id: number;
  articleId: string;
  sourceHash: string;
  sourceUrl: string | null;
  sourceFormat: string | null;
  title: string;
  fullText: string;
  fetchedAt: Date;
  supersededAt: Date;
}
