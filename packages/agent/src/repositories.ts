import { eq, and, sql, lte } from "drizzle-orm";
import type { Database } from "@legal-ai/db";
import {
  legislations,
  articles,
  riskCategories,
  obligations,
  penalties,
  deadlines,
  faq,
} from "@legal-ai/db";
import type {
  LegislationRepository,
  ArticleRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
  Legislation,
  Article,
  RiskCategory,
  Obligation,
  Penalty,
  Deadline,
  FAQ,
  ScoredResult,
  ObligationFilter,
} from "@legal-ai/core";

// --- Legislation ---

export class DrizzleLegislationRepository implements LegislationRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Legislation[]> {
    const rows = await this.db.select().from(legislations);
    return rows.map(toLegislation);
  }

  async findById(id: string): Promise<Legislation | null> {
    const rows = await this.db
      .select()
      .from(legislations)
      .where(eq(legislations.id, id));
    return rows.length > 0 ? toLegislation(rows[0]) : null;
  }
}

function toLegislation(row: typeof legislations.$inferSelect): Legislation {
  return {
    id: row.id,
    name: row.name,
    jurisdiction: row.jurisdiction,
    effectiveDate: row.effectiveDate,
    sourceUrl: row.sourceUrl ?? "",
    version: row.version ?? "",
  };
}

// --- Article ---

export class DrizzleArticleRepository implements ArticleRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Article[]> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(eq(articles.legislationId, legislationId));
    return rows.map(toArticle);
  }

  async findByNumber(
    legislationId: string,
    number: string,
  ): Promise<Article | null> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.legislationId, legislationId),
          eq(articles.number, number),
        ),
      );
    return rows.length > 0 ? toArticle(rows[0]) : null;
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<Article>[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const rows = await this.db
      .select({
        id: articles.id,
        legislationId: articles.legislationId,
        number: articles.number,
        title: articles.title,
        summary: articles.summary,
        fullText: articles.fullText,
        sourceUrl: articles.sourceUrl,
        relatedAnnexes: articles.relatedAnnexes,
        embedding: articles.embedding,
        createdAt: articles.createdAt,
        distance: sql<number>`embedding <=> ${vectorStr}::vector`,
      })
      .from(articles)
      .where(eq(articles.legislationId, legislationId))
      .orderBy(sql`embedding <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: toArticle(row),
      similarity: 1 - (row.distance ?? 1),
    }));
  }
}

function toArticle(row: typeof articles.$inferSelect): Article {
  return {
    id: row.id,
    legislationId: row.legislationId,
    number: row.number,
    title: row.title,
    summary: row.summary ?? "",
    fullText: row.fullText ?? "",
    sourceUrl: row.sourceUrl ?? null,
    relatedAnnexes: row.relatedAnnexes ?? [],
  };
}

// --- RiskCategory ---

export class DrizzleRiskCategoryRepository implements RiskCategoryRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<RiskCategory[]> {
    const rows = await this.db
      .select()
      .from(riskCategories)
      .where(eq(riskCategories.legislationId, legislationId));
    return rows.map(toRiskCategory);
  }

  async findByName(
    legislationId: string,
    name: string,
  ): Promise<RiskCategory | null> {
    const rows = await this.db
      .select()
      .from(riskCategories)
      .where(
        and(
          eq(riskCategories.legislationId, legislationId),
          eq(riskCategories.name, name),
        ),
      );
    return rows.length > 0 ? toRiskCategory(rows[0]) : null;
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<RiskCategory>[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const rows = await this.db
      .select({
        id: riskCategories.id,
        legislationId: riskCategories.legislationId,
        name: riskCategories.name,
        level: riskCategories.level,
        description: riskCategories.description,
        keywords: riskCategories.keywords,
        examples: riskCategories.examples,
        relevantArticles: riskCategories.relevantArticles,
        embedding: riskCategories.embedding,
        createdAt: riskCategories.createdAt,
        distance: sql<number>`embedding <=> ${vectorStr}::vector`,
      })
      .from(riskCategories)
      .where(eq(riskCategories.legislationId, legislationId))
      .orderBy(sql`embedding <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: toRiskCategory(row),
      similarity: 1 - (row.distance ?? 1),
    }));
  }
}

function toRiskCategory(
  row: typeof riskCategories.$inferSelect,
): RiskCategory {
  return {
    id: row.id,
    legislationId: row.legislationId,
    name: row.name,
    level: row.level,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    examples: row.examples ?? [],
    relevantArticles: row.relevantArticles ?? [],
  };
}

// --- Obligation ---

export class DrizzleObligationRepository implements ObligationRepository {
  constructor(private readonly db: Database) {}

  async findByFilter(filter: ObligationFilter): Promise<Obligation[]> {
    const conditions = [eq(obligations.legislationId, filter.legislationId)];
    if (filter.role) conditions.push(eq(obligations.role, filter.role));
    if (filter.riskLevel)
      conditions.push(eq(obligations.riskLevel, filter.riskLevel));
    if (filter.category)
      conditions.push(eq(obligations.category, filter.category));

    const rows = await this.db
      .select()
      .from(obligations)
      .where(and(...conditions));
    return rows.map(toObligation);
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<Obligation>[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const rows = await this.db
      .select({
        id: obligations.id,
        legislationId: obligations.legislationId,
        role: obligations.role,
        riskLevel: obligations.riskLevel,
        obligation: obligations.obligation,
        article: obligations.article,
        deadline: obligations.deadline,
        details: obligations.details,
        category: obligations.category,
        embedding: obligations.embedding,
        createdAt: obligations.createdAt,
        distance: sql<number>`embedding <=> ${vectorStr}::vector`,
      })
      .from(obligations)
      .where(eq(obligations.legislationId, legislationId))
      .orderBy(sql`embedding <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: toObligation(row),
      similarity: 1 - (row.distance ?? 1),
    }));
  }
}

function toObligation(row: typeof obligations.$inferSelect): Obligation {
  return {
    id: row.id,
    legislationId: row.legislationId,
    role: row.role,
    riskLevel: row.riskLevel,
    obligation: row.obligation,
    article: row.article ?? "",
    deadline: row.deadline,
    details: row.details ?? "",
    category: row.category ?? "",
  };
}

// --- Penalty ---

export class DrizzlePenaltyRepository implements PenaltyRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Penalty[]> {
    const rows = await this.db
      .select()
      .from(penalties)
      .where(eq(penalties.legislationId, legislationId));
    return rows.map(toPenalty);
  }

  async findByViolationType(
    legislationId: string,
    type: string,
  ): Promise<Penalty | null> {
    const rows = await this.db
      .select()
      .from(penalties)
      .where(
        and(
          eq(penalties.legislationId, legislationId),
          eq(penalties.violationType, type),
        ),
      );
    return rows.length > 0 ? toPenalty(rows[0]) : null;
  }
}

function toPenalty(row: typeof penalties.$inferSelect): Penalty {
  return {
    id: row.id,
    legislationId: row.legislationId,
    violationType: row.violationType,
    name: row.name,
    maxFineEur: row.maxFineEur ? parseFloat(row.maxFineEur) : 0,
    globalTurnoverPercentage: row.globalTurnoverPercentage
      ? parseFloat(row.globalTurnoverPercentage)
      : 0,
    article: row.article ?? "",
    description: row.description ?? "",
    applicableTo: row.applicableTo ?? [],
    smeRules: (row.smeRules as Record<string, unknown>) ?? null,
  };
}

// --- Deadline ---

export class DrizzleDeadlineRepository implements DeadlineRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Deadline[]> {
    const rows = await this.db
      .select()
      .from(deadlines)
      .where(eq(deadlines.legislationId, legislationId));
    return rows.map(toDeadline);
  }

  async findUpcoming(legislationId: string): Promise<Deadline[]> {
    const rows = await this.db
      .select()
      .from(deadlines)
      .where(
        and(
          eq(deadlines.legislationId, legislationId),
          lte(sql`now()`, deadlines.date),
        ),
      );
    return rows.map(toDeadline);
  }
}

function toDeadline(row: typeof deadlines.$inferSelect): Deadline {
  return {
    id: row.id,
    legislationId: row.legislationId,
    date: row.date,
    event: row.event,
    description: row.description ?? "",
  };
}

// --- FAQ ---

export class DrizzleFAQRepository implements FAQRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<FAQ[]> {
    const rows = await this.db
      .select()
      .from(faq)
      .where(eq(faq.legislationId, legislationId));
    return rows.map(toFAQ);
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<FAQ>[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const rows = await this.db
      .select({
        id: faq.id,
        legislationId: faq.legislationId,
        question: faq.question,
        answer: faq.answer,
        articleReferences: faq.articleReferences,
        keywords: faq.keywords,
        category: faq.category,
        sourceUrl: faq.sourceUrl,
        embedding: faq.embedding,
        createdAt: faq.createdAt,
        distance: sql<number>`embedding <=> ${vectorStr}::vector`,
      })
      .from(faq)
      .where(eq(faq.legislationId, legislationId))
      .orderBy(sql`embedding <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: toFAQ(row),
      similarity: 1 - (row.distance ?? 1),
    }));
  }
}

function toFAQ(row: typeof faq.$inferSelect): FAQ {
  return {
    id: row.id,
    legislationId: row.legislationId,
    question: row.question,
    answer: row.answer,
    articleReferences: row.articleReferences ?? [],
    keywords: row.keywords ?? [],
    category: row.category ?? "",
    sourceUrl: row.sourceUrl ?? null,
  };
}
