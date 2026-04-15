export interface RiskCategory {
  id: string;
  legislationId: string;
  name: string;
  level: number;
  description: string;
  keywords: string[];
  examples: string[];
  relevantArticles: string[];
}
