# ARD-002: PostgreSQL with pgvector for Storage and Semantic Search

## Status: Accepted
## Date: 2026-04-15

---

## Context

The platform stores regulation text (articles, annexes, obligations, FAQ) and needs both structured queries (lookup by article number, filter by role/risk level) and semantic search (find relevant articles for a natural language query). The lexbeam reference implementation hardcodes all data in TypeScript files with keyword matching only.

## Decision

Use PostgreSQL with the pgvector extension. Store both raw text and OpenAI embedding vectors in every content row.

### Schema Approach

Every table with searchable text content includes:

- Full text columns (title, body, summary) — retained as-is for deterministic lookups
- An `embedding vector(3072)` column — OpenAI `text-embedding-3-large` vector for semantic search
- A `legislation_id` foreign key — scoping all queries to a specific regulation

### Why pgvector Over Dedicated Vector DBs

| Factor | pgvector | Pinecone / Weaviate / Qdrant |
|--------|----------|------------------------------|
| Operational complexity | Single database | Two systems to manage |
| Transactional consistency | Same transaction as relational data | Eventual consistency |
| Hybrid queries | `WHERE legislation_id = $1 ORDER BY embedding <=> $2` in one query | Requires post-filtering or metadata sync |
| Cost | Included in Postgres | Separate billing |
| Scale needs | Thousands of regulation articles, not millions | Overkill |

### Vector Dimensions

Using `text-embedding-3-large` (3072 dimensions) for higher accuracy on legal text where nuance matters. The `dimensions` parameter can reduce this if performance requires it.

### Indexing

- HNSW index on embedding columns for approximate nearest neighbour search
- B-tree indexes on `legislation_id`, `article_number`, `role`, `risk_level` for structured queries
- GIN index on text columns for full-text search fallback

### Connection Management

- Drizzle ORM with `drizzle-orm/node-postgres` adapter
- Connection pool via `pg.Pool`, injected into repositories through the application layer
- Domain layer receives repository interfaces, never a raw pool

## Consequences

### Positive

- Single data store for structured + semantic queries
- Hybrid queries combine filters with vector similarity in one round-trip
- Regulation text is queryable via SQL — easy debugging, reporting, auditing
- Seeds are idempotent SQL inserts, version-controlled alongside the code
- Drizzle provides typed queries and migration management

### Negative

- Requires PostgreSQL (not serverless-friendly out of the box)
- pgvector adds a native extension dependency
- Embedding generation during seed adds time and OpenAI API cost

### Mitigations

- Docker Compose for local development with pgvector-enabled Postgres image
- Seed script caches embeddings to avoid re-generating on repeated runs
- Repository interface allows swapping storage without touching domain
