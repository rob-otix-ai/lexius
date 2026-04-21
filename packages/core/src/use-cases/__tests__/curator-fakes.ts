// Test doubles for curator use cases. No DB, no real transactions.

import type {
  ObligationRepository,
  CuratorEditRepository,
  CuratorEditInput,
  TransactionManager,
  TxScope,
  ArticleRepository,
  EmbeddingService,
  CrossCheckService,
  CrossCheckInput,
  CrossCheckResult,
  ObligationFilter,
  Obligation,
  ObligationMutableFields,
  CreateObligationInput,
  CuratorEdit,
  CuratorEditEntityType,
  ScoredResult,
  Article,
  Legislation,
  RiskCategory,
  Penalty,
  Deadline,
  FAQ,
  ArticleRevision,
  ArticleExtract,
} from "../../index.js";

export class FakeObligationRepository implements ObligationRepository {
  rows = new Map<string, Obligation>();

  seed(o: Obligation): void {
    this.rows.set(o.id, o);
  }

  async findByFilter(_: ObligationFilter): Promise<Obligation[]> {
    return Array.from(this.rows.values());
  }

  async findById(id: string): Promise<Obligation | null> {
    return this.rows.get(id) ?? null;
  }

  async searchSemantic(): Promise<ScoredResult<Obligation>[]> {
    return [];
  }

  async create(
    input: CreateObligationInput,
    curatedBy: string,
    reviewedAt: Date,
    _embedding: number[],
  ): Promise<Obligation> {
    const row: Obligation = {
      id: input.id,
      legislationId: input.legislationId,
      role: input.role,
      riskLevel: input.riskLevel,
      obligation: input.obligation,
      article: input.article,
      deadline: input.deadline,
      details: input.details,
      category: input.category,
      derivedFrom: input.derivedFrom,
      provenance: { tier: "CURATED", curatedBy, reviewedAt },
      rowVersion: 1,
      needsReview: false,
      staleSince: null,
      deprecatedAt: null,
      deprecatedReason: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(
    id: string,
    expectedRowVersion: number,
    changes: ObligationMutableFields,
    curatedBy: string,
    reviewedAt: Date,
    _embedding: number[] | null,
    clearStaleFlags: boolean,
  ): Promise<Obligation | null> {
    const current = this.rows.get(id);
    if (!current) return null;
    if (current.rowVersion !== expectedRowVersion) return null;
    const updated: Obligation = {
      ...current,
      ...changes,
      provenance: { tier: "CURATED", curatedBy, reviewedAt },
      rowVersion: current.rowVersion + 1,
      needsReview: clearStaleFlags ? false : current.needsReview,
      staleSince: clearStaleFlags ? null : current.staleSince,
    };
    this.rows.set(id, updated);
    return updated;
  }

  async deprecate(
    id: string,
    expectedRowVersion: number,
    reason: string,
    at: Date,
  ): Promise<Obligation | null> {
    const current = this.rows.get(id);
    if (!current) return null;
    if (current.rowVersion !== expectedRowVersion) return null;
    const updated: Obligation = {
      ...current,
      deprecatedAt: at,
      deprecatedReason: reason,
      rowVersion: current.rowVersion + 1,
    };
    this.rows.set(id, updated);
    return updated;
  }

  async markStaleByArticle(articleId: string, staleSince: Date): Promise<number> {
    let count = 0;
    for (const [id, row] of this.rows) {
      if (
        row.derivedFrom.includes(articleId) &&
        row.provenance.tier === "CURATED" &&
        !row.deprecatedAt
      ) {
        this.rows.set(id, { ...row, needsReview: true, staleSince });
        count++;
      }
    }
    return count;
  }

  async findStale(): Promise<Obligation[]> {
    return Array.from(this.rows.values()).filter((o) => o.needsReview);
  }
}

export class FakeCuratorEditRepository implements CuratorEditRepository {
  edits: CuratorEdit[] = [];
  private nextId = 1;

  async insert(input: CuratorEditInput): Promise<CuratorEdit> {
    const edit: CuratorEdit = {
      id: `edit-${this.nextId++}`,
      entityType: input.entityType,
      entityId: input.entityId,
      editorId: input.editorId,
      editorIp: input.editorIp ?? null,
      editorUa: input.editorUa ?? null,
      source: input.source,
      action: input.action,
      oldValues: input.oldValues,
      newValues: input.newValues,
      rowVersionBefore: input.rowVersionBefore,
      rowVersionAfter: input.rowVersionAfter,
      reason: input.reason,
      crossCheckResult: input.crossCheckResult,
      editedAt: new Date(),
    };
    this.edits.push(edit);
    return edit;
  }

  async findById(id: string): Promise<CuratorEdit | null> {
    return this.edits.find((e) => e.id === id) ?? null;
  }

  async findByEntity(
    entityType: CuratorEditEntityType,
    entityId: string,
  ): Promise<CuratorEdit[]> {
    return this.edits
      .filter((e) => e.entityType === entityType && e.entityId === entityId)
      .slice()
      .reverse();
  }

  async findByEditor(editorId: string, since?: Date): Promise<CuratorEdit[]> {
    return this.edits
      .filter(
        (e) =>
          e.editorId === editorId &&
          (since ? e.editedAt.getTime() >= since.getTime() : true),
      )
      .slice()
      .reverse();
  }
}

export class FakeArticleRepository implements ArticleRepository {
  existingIds = new Set<string>();

  async findByLegislation(): Promise<Article[]> { return []; }
  async findByNumber(): Promise<Article | null> { return null; }
  async findById(): Promise<Article | null> { return null; }
  async searchSemantic(): Promise<ScoredResult<Article>[]> { return []; }

  async findMissing(articleIds: string[]): Promise<string[]> {
    return articleIds.filter((id) => !this.existingIds.has(id));
  }
}

export class FakeEmbeddingService implements EmbeddingService {
  async embed(text: string): Promise<number[]> {
    // Deterministic stand-in: hash length + char codes into 4 numbers.
    return [text.length, text.charCodeAt(0) || 0, text.charCodeAt(1) || 0, 0];
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

export class FakeCrossCheckService implements CrossCheckService {
  result: CrossCheckResult = { ok: true, mismatches: [] };
  calls: CrossCheckInput[] = [];

  async run(input: CrossCheckInput): Promise<CrossCheckResult> {
    this.calls.push(input);
    return this.result;
  }
}

export class FakeTransactionManager implements TransactionManager {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly audit: CuratorEditRepository,
    private readonly articles: ArticleRepository,
  ) {}

  async transactional<T>(fn: (scope: TxScope) => Promise<T>): Promise<T> {
    const scope: TxScope = {
      obligations: this.obligations,
      audit: this.audit,
      articles: this.articles,
    };
    return fn(scope);
  }
}

export function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    id: "eu-ai-act-art-9-provider",
    legislationId: "eu-ai-act",
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Establish a risk management system",
    article: "9",
    deadline: null,
    details: "",
    category: "risk-management",
    derivedFrom: ["eu-ai-act-art-9"],
    provenance: {
      tier: "CURATED",
      curatedBy: "seed:rob",
      reviewedAt: new Date("2026-01-01T00:00:00Z"),
    },
    rowVersion: 1,
    needsReview: false,
    staleSince: null,
    deprecatedAt: null,
    deprecatedReason: null,
    ...overrides,
  };
}
