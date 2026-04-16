import type { Legislation } from "../entities/legislation.js";
import type { Article } from "../entities/article.js";
import type { RiskCategory } from "../entities/risk-category.js";
import type { Obligation } from "../entities/obligation.js";
import type { Penalty } from "../entities/penalty.js";
import type { Deadline } from "../entities/deadline.js";
import type { FAQ } from "../entities/faq.js";
import type { ScoredResult } from "../value-objects/search.js";
import type { ObligationFilter } from "../value-objects/obligation-filter.js";

export interface LegislationRepository {
  findAll(): Promise<Legislation[]>;
  findById(id: string): Promise<Legislation | null>;
}

export interface ArticleRepository {
  findByLegislation(legislationId: string): Promise<Article[]>;
  findByNumber(legislationId: string, number: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<Article>[]>;
}

export interface RiskCategoryRepository {
  findByLegislation(legislationId: string): Promise<RiskCategory[]>;
  findByName(legislationId: string, name: string): Promise<RiskCategory | null>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<RiskCategory>[]>;
}

export interface ObligationRepository {
  findByFilter(filter: ObligationFilter): Promise<Obligation[]>;
  findById(id: string): Promise<Obligation | null>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<Obligation>[]>;
}

export interface PenaltyRepository {
  findByLegislation(legislationId: string): Promise<Penalty[]>;
  findByViolationType(legislationId: string, type: string): Promise<Penalty | null>;
}

export interface DeadlineRepository {
  findByLegislation(legislationId: string): Promise<Deadline[]>;
  findUpcoming(legislationId: string): Promise<Deadline[]>;
}

export interface FAQRepository {
  findByLegislation(legislationId: string): Promise<FAQ[]>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<FAQ>[]>;
}
