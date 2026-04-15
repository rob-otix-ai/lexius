# DDD-004: Infrastructure Layer — Database, Embeddings, and Containerisation

## Status: Draft
## Date: 2026-04-15

---

## Overview

The infrastructure layer implements domain ports with concrete technology. It is the only layer that knows about PostgreSQL, OpenAI, Docker, or any external service. All infrastructure is injected into use cases through the composition root.

## Database (Containerised PostgreSQL + pgvector)

### Docker Compose

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: legal_ai
      POSTGRES_USER: legal_ai
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U legal_ai"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

The database runs in a container. No local PostgreSQL installation required. `docker compose up db` starts it.

### Drizzle Schema

Each domain entity maps to a Drizzle table definition in `packages/db/src/schema/`:

```typescript
// packages/db/src/schema/articles.ts
import { pgTable, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core"; // pgvector support

export const articles = pgTable("articles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  legislationId: varchar("legislation_id", { length: 64 }).notNull().references(() => legislations.id),
  number: varchar("number", { length: 16 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  fullText: text("full_text").notNull(),
  sourceUrl: text("source_url"),
  relatedAnnexes: text("related_annexes").array(),
  embedding: vector("embedding", { dimensions: 3072 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  legislationIdx: index("articles_legislation_idx").on(table.legislationId),
  numberIdx: index("articles_number_idx").on(table.legislationId, table.number),
  embeddingIdx: index("articles_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
}));
```

### Repository Implementations

```typescript
// packages/db/src/repositories/article.repository.ts
import { ArticleRepository, Article, ScoredResult } from "@legal-ai/core";

export class DrizzleArticleRepository implements ArticleRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findByLegislation(legislationId: string): Promise<Article[]> {
    return this.db.select().from(articles).where(eq(articles.legislationId, legislationId));
  }

  async searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<Article>[]> {
    return this.db.execute(sql`
      SELECT *, 1 - (embedding <=> ${embedding}::vector) AS similarity
      FROM articles
      WHERE legislation_id = ${legislationId}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${limit}
    `);
  }
}
```

### Seed Process

```
seeds/eu-ai-act/
├── legislation.json       # Legislation metadata
├── articles.json          # 27 articles with full text + summaries
├── annex-iii.json         # 8 high-risk categories
├── prohibited.json        # 8 prohibited practices
├── transparency.json      # 4 transparency triggers
├── obligations.json       # Provider, deployer, GPAI obligations
├── penalties.json         # 3 penalty tiers
├── deadlines.json         # 5 milestones
└── faq.json               # 24+ FAQ entries
```

Seed script:

1. Read JSON source files
2. Upsert legislation record
3. For each content file:
   a. Compute text hash
   b. If hash changed (or first run), call OpenAI embedding API
   c. Upsert row with text + embedding
4. Log summary (rows inserted, embeddings generated, cost)

Idempotent — safe to run repeatedly. Embedding cache avoids redundant API calls.

## OpenAI Embedding Service

```typescript
// packages/core/src/infrastructure/openai-embedding.service.ts
import OpenAI from "openai";
import { EmbeddingService } from "../domain/ports/embedding.service";

export class OpenAIEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;
  private readonly model = "text-embedding-3-large";

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}
```

## Composition Root

The composition root wires everything together. One per consumer, but they all build the same dependency graph:

```typescript
// packages/api/src/composition-root.ts
export function createContainer(config: AppConfig) {
  // Infrastructure
  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool);
  const embeddingService = new OpenAIEmbeddingService(config.openaiApiKey);

  // Repositories
  const legislationRepo = new DrizzleLegislationRepository(db);
  const articleRepo = new DrizzleArticleRepository(db);
  const obligationRepo = new DrizzleObligationRepository(db);
  const penaltyRepo = new DrizzlePenaltyRepository(db);
  const deadlineRepo = new DrizzleDeadlineRepository(db);
  const faqRepo = new DrizzleFAQRepository(db);
  const riskCategoryRepo = new DrizzleRiskCategoryRepository(db);

  // Legislation plugins
  const pluginRegistry = new InMemoryPluginRegistry();
  pluginRegistry.register(new EuAiActPlugin());

  // Use cases
  const classifySystem = new ClassifySystem(pluginRegistry, riskCategoryRepo, obligationRepo, embeddingService);
  const getObligations = new GetObligations(obligationRepo);
  const calculatePenalty = new CalculatePenalty(pluginRegistry, penaltyRepo);
  const searchKnowledge = new SearchKnowledge(embeddingService, articleRepo, obligationRepo, faqRepo, riskCategoryRepo);
  const getArticle = new GetArticle(articleRepo);
  const getDeadlines = new GetDeadlines(deadlineRepo);
  const answerQuestion = new AnswerQuestion(faqRepo, embeddingService);
  const runAssessment = new RunAssessment(pluginRegistry);
  const listLegislations = new ListLegislations(legislationRepo);

  return {
    classifySystem,
    getObligations,
    calculatePenalty,
    searchKnowledge,
    getArticle,
    getDeadlines,
    answerQuestion,
    runAssessment,
    listLegislations,
  };
}
```

## Environment Configuration

```
DATABASE_URL=postgresql://legal_ai:password@localhost:5432/legal_ai
OPENAI_API_KEY=sk-...
PORT=3000
NODE_ENV=development
```

All secrets via environment variables, never in code (enforced by specflow SEC-001 contract).
