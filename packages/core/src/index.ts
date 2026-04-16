// Domain: Entities
export type {
  Legislation,
  Article,
  RiskCategory,
  Obligation,
  Penalty,
  Deadline,
  FAQ,
  ArticleRevision,
} from "./domain/entities/index.js";

// Domain: Value Objects
export type {
  ClassifyInput,
  ClassifyOutput,
  PenaltyInput,
  PenaltyOutput,
  SemanticSearchInput,
  ScoredResult,
  ObligationFilter,
  DeadlineWithStatus,
  AssessmentDefinition,
  AssessmentOutput,
  AuditInput,
  AuditOptions,
  ComplianceReport,
  ReportConfidence,
  AuditSource,
  EnhancedComplianceReport,
  ProvenanceTier,
  Provenance,
} from "./domain/value-objects/index.js";
export {
  PROVENANCE_TIERS,
  tierRank,
  atLeast,
  authoritative,
  curated,
  aiGenerated,
} from "./domain/value-objects/index.js";

// Domain: Ports
export type {
  LegislationRepository,
  ArticleRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
  ArticleRevisionRepository,
} from "./domain/ports/index.js";
export type { EmbeddingService } from "./domain/ports/index.js";
export type { EnhancementService, ReportEnhancement } from "./domain/ports/index.js";

// Domain: Plugin System
export type {
  LegislationPlugin,
  LegislationPluginRegistry,
  SignalField,
  SignalSchema,
} from "./domain/plugin.js";

// Use Cases
export {
  ClassifySystem,
  GetObligations,
  CalculatePenalty,
  SearchKnowledge,
  GetArticle,
  GetDeadlines,
  AnswerQuestion,
  RunAssessment,
  ListLegislations,
  GenerateAuditReport,
  EnhanceAuditReport,
  GetDerivationChain,
  GetArticleHistory,
} from "./use-cases/index.js";
export type {
  AnswerQuestionResult,
  DerivationChain,
  ArticleHistoryEntry,
} from "./use-cases/index.js";

// Infrastructure
export { InMemoryPluginRegistry } from "./infrastructure/index.js";

// Legislation Plugins
export { EuAiActPlugin } from "./legislation/index.js";

// Composition
export { createContainer } from "./composition.js";
export type { ContainerDependencies } from "./composition.js";
