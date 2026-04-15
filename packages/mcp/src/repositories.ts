import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@lexius/db";
import {
  legislations,
  articles,
  riskCategories,
  obligations,
  penalties,
  deadlines,
  faq,
} from "@lexius/db";
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
} from "@lexius/core";

// ── Legislation ──────────────────────────────────────────────────────

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

// ── Article ──────────────────────────────────────────────────────────

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
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM articles
      WHERE legislation_id = ${legislationId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows as any[]).map((row) => ({
      item: toArticleFromRaw(row),
      similarity: parseFloat(row.similarity),
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

function toArticleFromRaw(row: any): Article {
  return {
    id: row.id,
    legislationId: row.legislation_id,
    number: row.number,
    title: row.title,
    summary: row.summary ?? "",
    fullText: row.full_text ?? "",
    sourceUrl: row.source_url ?? null,
    relatedAnnexes: row.related_annexes ?? [],
  };
}

// ── RiskCategory ─────────────────────────────────────────────────────

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
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM risk_categories
      WHERE legislation_id = ${legislationId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows as any[]).map((row) => ({
      item: toRiskCategoryFromRaw(row),
      similarity: parseFloat(row.similarity),
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

function toRiskCategoryFromRaw(row: any): RiskCategory {
  return {
    id: row.id,
    legislationId: row.legislation_id,
    name: row.name,
    level: row.level,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    examples: row.examples ?? [],
    relevantArticles: row.relevant_articles ?? [],
  };
}

// ── Obligation ───────────────────────────────────────────────────────

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
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM obligations
      WHERE legislation_id = ${legislationId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows as any[]).map((row) => ({
      item: toObligationFromRaw(row),
      similarity: parseFloat(row.similarity),
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

function toObligationFromRaw(row: any): Obligation {
  return {
    id: row.id,
    legislationId: row.legislation_id,
    role: row.role,
    riskLevel: row.risk_level,
    obligation: row.obligation,
    article: row.article ?? "",
    deadline: row.deadline ? new Date(row.deadline) : null,
    details: row.details ?? "",
    category: row.category ?? "",
  };
}

// ── Penalty ──────────────────────────────────────────────────────────

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

// ── Deadline ─────────────────────────────────────────────────────────

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
          sql`date > now()`,
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

// ── FAQ ──────────────────────────────────────────────────────────────

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
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM faq
      WHERE legislation_id = ${legislationId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows as any[]).map((row) => ({
      item: toFAQFromRaw(row),
      similarity: parseFloat(row.similarity),
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

function toFAQFromRaw(row: any): FAQ {
  return {
    id: row.id,
    legislationId: row.legislation_id,
    question: row.question,
    answer: row.answer,
    articleReferences: row.article_references ?? [],
    keywords: row.keywords ?? [],
    category: row.category ?? "",
    sourceUrl: row.source_url ?? null,
  };
}
