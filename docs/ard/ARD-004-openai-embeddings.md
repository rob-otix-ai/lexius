# ARD-004: OpenAI Embeddings for Semantic Search

## Status: Accepted
## Date: 2026-04-15

---

## Context

The platform needs semantic search across regulation text — users ask questions in natural language and expect relevant articles, obligations, and FAQ entries. The lexbeam reference uses keyword matching only, which misses semantically related but lexically different queries.

## Decision

Use OpenAI's `text-embedding-3-large` model to generate embeddings. Store vectors in pgvector alongside the source text.

### Embedding Strategy

**What gets embedded:**

| Content | Embedding Input | Column |
|---------|-----------------|--------|
| Articles | `{title}. {summary}. {full_text}` | `articles.embedding` |
| Annex III categories | `{name}. {description}. {examples joined}` | `annex_iii_categories.embedding` |
| Obligations | `{obligation}. {details}` | `obligations.embedding` |
| FAQ entries | `{question}. {answer}` | `faq.embedding` |
| Prohibited practices | `{name}. {description}. {examples joined}` | `prohibited_practices.embedding` |

**What does NOT get embedded:**

- Penalties (queried by violation type, not semantically)
- Deadlines (queried by date, not semantically)
- Structured signals (boolean/enum, not text)

### Embedding at Seed Time

Embeddings are generated during the seed process, not at query time:

1. Seed script reads source text
2. Batches text through OpenAI `embeddings.create()` endpoint
3. Stores `[text, embedding]` pairs in Postgres
4. Cached: if a row's text hash hasn't changed, skip re-embedding

### Query Flow

```
User query: "What are the rules for facial recognition?"
        │
        ▼
  OpenAI embed(query)  →  vector(3072)
        │
        ▼
  SELECT *, 1 - (embedding <=> $1) AS similarity
  FROM articles
  WHERE legislation_id = 'eu-ai-act'
  ORDER BY embedding <=> $1
  LIMIT 5
        │
        ▼
  Ranked results with similarity scores
```

### Domain Integration

The embedding service is a port in the domain layer:

```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

The OpenAI implementation lives in infrastructure. The domain never knows about OpenAI. This means we can swap to a different embedding provider (Cohere, local model, etc.) without touching domain logic.

### Cost Considerations

- `text-embedding-3-large`: ~$0.13 per 1M tokens
- Full EU AI Act corpus: ~50K tokens total
- Cost per full re-seed: < $0.01
- Query embeddings: negligible at expected volumes

## Consequences

### Positive

- Semantic search finds relevant content that keyword matching misses
- Hybrid queries combine vector similarity with structured filters
- Embedding service is swappable via port interface
- Seed-time generation means zero latency impact on queries (only the query itself needs embedding)

### Negative

- External dependency on OpenAI API (for seed and query)
- Embedding model changes require re-seeding
- 3072-dimension vectors use more storage than smaller models

### Mitigations

- Seed script caches by text hash — model changes trigger full re-embed
- `EmbeddingService` port allows fallback to local models if OpenAI is unavailable
- At our data volume, storage is negligible
