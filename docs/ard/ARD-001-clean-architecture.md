# ARD-001: Clean Architecture with Legislation Plugin System

## Status: Accepted
## Date: 2026-04-15

---

## Context

We are building a compliance platform that must support multiple legislations (EU AI Act, DORA, NIS2, etc.) without modifying the core domain. Each regulation has different classification taxonomies, obligation structures, penalty frameworks, and assessment logic. We need an architecture that isolates legislation-specific rules from the generic compliance engine.

## Decision

Adopt Clean Architecture (Ports & Adapters) with a legislation plugin system.

### Layer Structure

```
┌─────────────────────────────────────────────┐
│  Infrastructure (outermost)                  │
│  Express routes, Drizzle repos, OpenAI       │
│  client, MCP handlers, CLI commands          │
├─────────────────────────────────────────────┤
│  Application                                 │
│  Use case orchestration, DTOs, input         │
│  validation, legislation plugin registry     │
├─────────────────────────────────────────────┤
│  Domain (innermost)                          │
│  Entities, value objects, domain services,   │
│  port interfaces, legislation plugin         │
│  interface                                   │
└─────────────────────────────────────────────┘
```

### Dependency Rule

Dependencies point inward only. Domain knows nothing about infrastructure. Application depends on domain. Infrastructure depends on application and domain (implementing ports).

### Legislation Plugin Interface

```typescript
interface LegislationPlugin {
  id: string;                    // e.g., "eu-ai-act"
  name: string;                  // e.g., "EU AI Act (Regulation 2024/1689)"
  version: string;

  // Classification
  classifySystem(input: ClassifyInput): ClassifyOutput;
  getRiskCategories(): RiskCategory[];

  // Obligations
  getObligations(filter: ObligationFilter): Obligation[];

  // Penalties
  calculatePenalty(input: PenaltyInput): PenaltyOutput;

  // Legislation-specific assessments (optional)
  getAssessments(): Assessment[];
  runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput;
}
```

The EU AI Act plugin implements this interface and adds its specific assessments (Art. 6(3) exception, GPAI systemic risk). When DORA is added, a new plugin is written — same interface, different rules.

### Port Interfaces (Domain Layer)

```typescript
// Repository ports
interface ArticleRepository {
  findByLegislation(legislationId: string): Promise<Article[]>;
  findByNumber(legislationId: string, number: string): Promise<Article | null>;
  searchSemantic(legislationId: string, query: string, limit: number): Promise<Article[]>;
}

interface ObligationRepository {
  findByFilter(filter: ObligationFilter): Promise<Obligation[]>;
}

// Service ports
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

## Consequences

### Positive

- Adding a regulation = writing a plugin + seed data, zero core changes
- Domain logic is testable without any infrastructure
- Any consumer (API, MCP, CLI, Agent) calls the same use cases
- Legislation-specific logic is contained and auditable
- specflow contracts can enforce the dependency rule mechanically

### Negative

- More files and indirection than a simple monolith
- Plugin interface must be general enough for diverse regulations — may need iteration
- Risk of over-abstraction if we design for hypothetical regulations before they exist

### Mitigations

- Start with only the EU AI Act plugin; refine the interface when the second regulation arrives
- Keep the plugin interface minimal — specific assessments go in an extensible `assessments` map
- specflow ARCH contracts prevent layer violations automatically

## Alternatives Considered

1. **Feature flags per legislation** — rejected; leads to tangled conditionals
2. **Separate repos per regulation** — rejected; duplicates shared infrastructure
3. **Configuration-driven rules engine** — rejected; regulations are too diverse for a generic DSL
