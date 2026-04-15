export interface Obligation {
  id: string;
  legislationId: string;
  role: string;
  riskLevel: string;
  obligation: string;
  article: string;
  deadline: Date | null;
  details: string;
  category: string;
}
