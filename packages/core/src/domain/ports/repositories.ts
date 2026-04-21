import type { Legislation } from "../entities/legislation.js";
import type { Article } from "../entities/article.js";
import type { RiskCategory } from "../entities/risk-category.js";
import type {
  Obligation,
  ObligationMutableFields,
  CreateObligationInput,
} from "../entities/obligation.js";
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
  findMissing(articleIds: string[]): Promise<string[]>;
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

  // Curator write surface — every caller must route through the UpdateCurated
  // Obligation / CreateCuratedObligation / DeprecateCuratedObligation use
  // cases. PROV-008 forbids any other call site.
  create(
    input: CreateObligationInput,
    curatedBy: string,
    reviewedAt: Date,
    embedding: number[],
  ): Promise<Obligation>;
  update(
    id: string,
    expectedRowVersion: number,
    changes: ObligationMutableFields,
    curatedBy: string,
    reviewedAt: Date,
    embedding: number[] | null,
    clearStaleFlags: boolean,
  ): Promise<Obligation | null>;
  deprecate(
    id: string,
    expectedRowVersion: number,
    reason: string,
    at: Date,
  ): Promise<Obligation | null>;
  markStaleByArticle(
    articleId: string,
    staleSince: Date,
  ): Promise<number>;
  findStale(): Promise<Obligation[]>;
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
