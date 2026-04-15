import { createDb, type Database } from "@lexius/db";
import { logger } from "./logger.js";
import {
  legislations,
  articles,
  riskCategories,
  obligations,
  penalties,
  deadlines,
  faq,
} from "@lexius/db";
import { eq, and, sql } from "drizzle-orm";
import { createContainer } from "@lexius/core";
import type {
  LegislationRepository,
  ArticleRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
  EmbeddingService,
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
import OpenAI from "openai";
import type pg from "pg";

// --- Repository Implementations ---

class DrizzleLegislationRepository implements LegislationRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Legislation[]> {
    const rows = await this.db.select().from(legislations);
    return rows.map(mapLegislation);
  }

  async findById(id: string): Promise<Legislation | null> {
    const rows = await this.db
      .select()
      .from(legislations)
      .where(eq(legislations.id, id));
    return rows.length > 0 ? mapLegislation(rows[0]) : null;
  }
}

class DrizzleArticleRepository implements ArticleRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Article[]> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(eq(articles.legislationId, legislationId));
    return rows.map(mapArticle);
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
    return rows.length > 0 ? mapArticle(rows[0]) : null;
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
        similarity: sql<number>`1 - (${articles.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(articles)
      .where(eq(articles.legislationId, legislationId))
      .orderBy(sql`${articles.embedding} <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: mapArticle(row),
      similarity: row.similarity,
    }));
  }
}

class DrizzleRiskCategoryRepository implements RiskCategoryRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<RiskCategory[]> {
    const rows = await this.db
      .select()
      .from(riskCategories)
      .where(eq(riskCategories.legislationId, legislationId));
    return rows.map(mapRiskCategory);
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
    return rows.length > 0 ? mapRiskCategory(rows[0]) : null;
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
        similarity: sql<number>`1 - (${riskCategories.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(riskCategories)
      .where(eq(riskCategories.legislationId, legislationId))
      .orderBy(sql`${riskCategories.embedding} <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: mapRiskCategory(row),
      similarity: row.similarity,
    }));
  }
}

class DrizzleObligationRepository implements ObligationRepository {
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
    return rows.map(mapObligation);
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
        similarity: sql<number>`1 - (${obligations.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(obligations)
      .where(eq(obligations.legislationId, legislationId))
      .orderBy(sql`${obligations.embedding} <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: mapObligation(row),
      similarity: row.similarity,
    }));
  }
}

class DrizzlePenaltyRepository implements PenaltyRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Penalty[]> {
    const rows = await this.db
      .select()
      .from(penalties)
      .where(eq(penalties.legislationId, legislationId));
    return rows.map(mapPenalty);
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
    return rows.length > 0 ? mapPenalty(rows[0]) : null;
  }
}

class DrizzleDeadlineRepository implements DeadlineRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<Deadline[]> {
    const rows = await this.db
      .select()
      .from(deadlines)
      .where(eq(deadlines.legislationId, legislationId));
    return rows.map(mapDeadline);
  }

  async findUpcoming(legislationId: string): Promise<Deadline[]> {
    const rows = await this.db
      .select()
      .from(deadlines)
      .where(
        and(
          eq(deadlines.legislationId, legislationId),
          sql`${deadlines.date} > now()`,
        ),
      );
    return rows.map(mapDeadline);
  }
}

class DrizzleFAQRepository implements FAQRepository {
  constructor(private readonly db: Database) {}

  async findByLegislation(legislationId: string): Promise<FAQ[]> {
    const rows = await this.db
      .select()
      .from(faq)
      .where(eq(faq.legislationId, legislationId));
    return rows.map(mapFAQ);
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
        similarity: sql<number>`1 - (${faq.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(faq)
      .where(eq(faq.legislationId, legislationId))
      .orderBy(sql`${faq.embedding} <=> ${vectorStr}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      item: mapFAQ(row),
      similarity: row.similarity,
    }));
  }
}

// --- OpenAI Embedding Service ---

class OpenAIEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-large",
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}

// --- Row Mappers ---

function mapLegislation(row: Record<string, unknown>): Legislation {
  return {
    id: row.id as string,
    name: row.name as string,
    jurisdiction: row.jurisdiction as string,
    effectiveDate: row.effectiveDate as Date,
    sourceUrl: (row.sourceUrl as string) ?? "",
    version: (row.version as string) ?? "",
  };
}

function mapArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    number: row.number as string,
    title: row.title as string,
    summary: (row.summary as string) ?? "",
    fullText: (row.fullText as string) ?? "",
    sourceUrl: (row.sourceUrl as string | null) ?? null,
    relatedAnnexes: (row.relatedAnnexes as string[]) ?? [],
  };
}

function mapRiskCategory(row: Record<string, unknown>): RiskCategory {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    name: row.name as string,
    level: row.level as number,
    description: (row.description as string) ?? "",
    keywords: (row.keywords as string[]) ?? [],
    examples: (row.examples as string[]) ?? [],
    relevantArticles: (row.relevantArticles as string[]) ?? [],
  };
}

function mapObligation(row: Record<string, unknown>): Obligation {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    role: row.role as string,
    riskLevel: row.riskLevel as string,
    obligation: row.obligation as string,
    article: (row.article as string) ?? "",
    deadline: (row.deadline as Date | null) ?? null,
    details: (row.details as string) ?? "",
    category: (row.category as string) ?? "",
  };
}

function mapPenalty(row: Record<string, unknown>): Penalty {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    violationType: row.violationType as string,
    name: row.name as string,
    maxFineEur: Number(row.maxFineEur ?? 0),
    globalTurnoverPercentage: Number(row.globalTurnoverPercentage ?? 0),
    article: (row.article as string) ?? "",
    description: (row.description as string) ?? "",
    applicableTo: (row.applicableTo as string[]) ?? [],
    smeRules: (row.smeRules as Record<string, unknown> | null) ?? null,
  };
}

function mapDeadline(row: Record<string, unknown>): Deadline {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    date: row.date as Date,
    event: row.event as string,
    description: (row.description as string) ?? "",
  };
}

function mapFAQ(row: Record<string, unknown>): FAQ {
  return {
    id: row.id as string,
    legislationId: row.legislationId as string,
    question: row.question as string,
    answer: row.answer as string,
    articleReferences: (row.articleReferences as string[]) ?? [],
    keywords: (row.keywords as string[]) ?? [],
    category: (row.category as string) ?? "",
    sourceUrl: (row.sourceUrl as string | null) ?? null,
  };
}

// --- Container Setup ---

export async function getContainer() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://localhost:5432/legal-ai";

  logger.debug({ connectionString }, "Connecting to database");

  const { db, pool } = createDb(connectionString);

  logger.debug("Creating dependency injection container");

  const container = createContainer({
    legislationRepo: new DrizzleLegislationRepository(db),
    articleRepo: new DrizzleArticleRepository(db),
    riskCategoryRepo: new DrizzleRiskCategoryRepository(db),
    obligationRepo: new DrizzleObligationRepository(db),
    penaltyRepo: new DrizzlePenaltyRepository(db),
    deadlineRepo: new DrizzleDeadlineRepository(db),
    faqRepo: new DrizzleFAQRepository(db),
    embeddingService: new OpenAIEmbeddingService(),
  });

  const cleanup = async () => {
    await (pool as pg.Pool).end();
  };

  return { container, cleanup };
}
