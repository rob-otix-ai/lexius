import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  legislations,
  articles,
  articleRevisions,
  articleExtracts,
  riskCategories,
  obligations,
  penalties,
  deadlines,
  faq,
} from "@lexius/db";
import type { Database } from "@lexius/db";
import type {
  LegislationRepository,
  ArticleRepository,
  ArticleRevisionRepository,
  ArticleExtractRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
} from "@lexius/core";
import type {
  Legislation,
  Article,
  ArticleRevision,
  ArticleExtract,
  RiskCategory,
  Obligation,
  Penalty,
  Deadline,
  FAQ,
  ScoredResult,
  ObligationFilter,
  Provenance,
  ProvenanceTier,
} from "@lexius/core";
import { PROVENANCE_TIERS, tierRank } from "@lexius/core";

// ── Provenance row mapping ───────────────────────────────────────────

interface ProvenanceRow {
  provenanceTier: ProvenanceTier;
  sourceUrl: string | null;
  sourceHash: string | null;
  fetchedAt: Date | null;
  curatedBy: string | null;
  reviewedAt: Date | null;
  generatedByModel: string | null;
  generatedAt: Date | null;
}

function rowToProvenance(row: ProvenanceRow): Provenance {
  switch (row.provenanceTier) {
    case "AUTHORITATIVE":
      // CHECK constraint guarantees these are set for AUTHORITATIVE rows.
      return {
        tier: "AUTHORITATIVE",
        sourceUrl: row.sourceUrl!,
        sourceHash: row.sourceHash!,
        fetchedAt: row.fetchedAt!,
      };
    case "CURATED":
      return {
        tier: "CURATED",
        curatedBy: row.curatedBy!,
        reviewedAt: row.reviewedAt!,
        sourceUrl: row.sourceUrl ?? undefined,
      };
    case "AI_GENERATED":
      return {
        tier: "AI_GENERATED",
        generatedByModel: row.generatedByModel!,
        generatedAt: row.generatedAt!,
      };
  }
}

function rawToProvenance(row: {
  provenance_tier: ProvenanceTier;
  source_url: string | null;
  source_hash: string | null;
  fetched_at: string | Date | null;
  curated_by: string | null;
  reviewed_at: string | Date | null;
  generated_by_model: string | null;
  generated_at: string | Date | null;
}): Provenance {
  const asDate = (v: string | Date | null): Date | null =>
    v === null ? null : v instanceof Date ? v : new Date(v);
  return rowToProvenance({
    provenanceTier: row.provenance_tier,
    sourceUrl: row.source_url,
    sourceHash: row.source_hash,
    fetchedAt: asDate(row.fetched_at),
    curatedBy: row.curated_by,
    reviewedAt: asDate(row.reviewed_at),
    generatedByModel: row.generated_by_model,
    generatedAt: asDate(row.generated_at),
  });
}

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

  async findById(id: string): Promise<Article | null> {
    const rows = await this.db.select().from(articles).where(eq(articles.id, id));
    return rows.length > 0 ? toArticle(rows[0]) : null;
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<Article>[]> {
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM articles
      WHERE legislation_id = ${legislationId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((row) => ({
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
    provenance: rowToProvenance(row),
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
    provenance: rawToProvenance(row),
  };
}

// ── ArticleRevision ──────────────────────────────────────────────────

export class DrizzleArticleRevisionRepository
  implements ArticleRevisionRepository
{
  constructor(private readonly db: Database) {}

  async findByArticleId(articleId: string): Promise<ArticleRevision[]> {
    const rows = await this.db
      .select()
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, articleId))
      .orderBy(desc(articleRevisions.supersededAt));

    return rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      sourceHash: r.sourceHash,
      sourceUrl: r.sourceUrl,
      sourceFormat: r.sourceFormat,
      title: r.title,
      fullText: r.fullText,
      fetchedAt: r.fetchedAt,
      supersededAt: r.supersededAt,
    }));
  }
}

// ── ArticleExtract ───────────────────────────────────────────────────

function toArticleExtract(row: typeof articleExtracts.$inferSelect): ArticleExtract {
  return {
    id: row.id,
    articleId: row.articleId,
    extractType: row.extractType,
    valueNumeric: row.valueNumeric,
    valueText: row.valueText,
    valueDate: row.valueDate,
    paragraphRef: row.paragraphRef,
    verbatimExcerpt: row.verbatimExcerpt,
    sourceHash: row.sourceHash,
    extractedAt: row.extractedAt,
  };
}

export class DrizzleArticleExtractRepository
  implements ArticleExtractRepository
{
  constructor(private readonly db: Database) {}

  async findByArticleId(articleId: string): Promise<ArticleExtract[]> {
    const rows = await this.db
      .select()
      .from(articleExtracts)
      .where(eq(articleExtracts.articleId, articleId))
      .orderBy(articleExtracts.extractType, articleExtracts.paragraphRef);
    return rows.map(toArticleExtract);
  }

  async findByArticleAndType(
    articleId: string,
    type: ArticleExtract["extractType"],
  ): Promise<ArticleExtract[]> {
    const rows = await this.db
      .select()
      .from(articleExtracts)
      .where(
        and(
          eq(articleExtracts.articleId, articleId),
          eq(articleExtracts.extractType, type),
        ),
      )
      .orderBy(articleExtracts.paragraphRef);
    return rows.map(toArticleExtract);
  }
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
      SELECT *,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM risk_categories
      WHERE legislation_id = ${legislationId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((row) => ({
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
    provenance: rowToProvenance(row),
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
    provenance: rawToProvenance(row),
  };
}

// ── Obligation ───────────────────────────────────────────────────────

export class DrizzleObligationRepository implements ObligationRepository {
  constructor(private readonly db: Database) {}

  async findByFilter(filter: ObligationFilter): Promise<Obligation[]> {
    const conditions = [eq(obligations.legislationId, filter.legislationId)];

    if (filter.role) {
      conditions.push(eq(obligations.role, filter.role));
    }
    if (filter.riskLevel) {
      conditions.push(eq(obligations.riskLevel, filter.riskLevel));
    }
    if (filter.category) {
      conditions.push(eq(obligations.category, filter.category));
    }
    if (filter.minTier) {
      const minRank = tierRank(filter.minTier);
      const allowed = PROVENANCE_TIERS.filter((t) => tierRank(t) >= minRank);
      conditions.push(inArray(obligations.provenanceTier, allowed));
    }

    const rows = await this.db
      .select()
      .from(obligations)
      .where(and(...conditions));
    return rows.map(toObligation);
  }

  async findById(id: string): Promise<Obligation | null> {
    const rows = await this.db
      .select()
      .from(obligations)
      .where(eq(obligations.id, id));
    return rows.length > 0 ? toObligation(rows[0]) : null;
  }

  async searchSemantic(
    legislationId: string,
    embedding: number[],
    limit: number,
  ): Promise<ScoredResult<Obligation>[]> {
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT *,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM obligations
      WHERE legislation_id = ${legislationId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((row) => ({
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
    derivedFrom: row.derivedFrom ?? [],
    provenance: rowToProvenance(row),
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
    derivedFrom: row.derived_from ?? [],
    provenance: rawToProvenance(row),
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
    provenance: rowToProvenance(row),
    derivedFrom: row.derivedFrom ?? [],
    extractExempt: row.extractExempt ?? false,
    extractExemptReason: row.extractExemptReason ?? null,
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
          sql`${deadlines.date} >= NOW()`,
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
    provenance: rowToProvenance(row),
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
      SELECT *,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM faq
      WHERE legislation_id = ${legislationId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((row) => ({
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
    derivedFrom: row.derivedFrom ?? [],
    provenance: rowToProvenance(row),
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
    derivedFrom: row.derived_from ?? [],
    provenance: rawToProvenance(row),
  };
}
