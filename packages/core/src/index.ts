// Domain: Entities
export type {
  Legislation,
  Article,
  RiskCategory,
  Obligation,
  ObligationMutableFields,
  CreateObligationInput,
  Penalty,
  Deadline,
  FAQ,
  ArticleRevision,
  ArticleExtract,
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
  ArticleExtractRepository,
  CuratorEditRepository,
  CuratorEditInput,
  TransactionManager,
  TxScope,
} from "./domain/ports/index.js";
export type { EmbeddingService } from "./domain/ports/index.js";
export type { EnhancementService, ReportEnhancement } from "./domain/ports/index.js";

// Domain: Services
export type {
  CrossCheckEntityType,
  CrossCheckInput,
  CrossCheckMismatch,
  CrossCheckResult,
  CrossCheckService,
  ArticleExistenceChecker,
} from "./domain/services/index.js";
export {
  CrossCheckFailed,
  touchesNumericFields,
  numericFieldsFor,
  DerivedFromRequired,
  DerivedFromUnresolved,
  assertDerivedFromNonEmpty,
  assertDerivedFromResolves,
} from "./domain/services/index.js";

// Domain: Tier transitions + curator edit errors
export {
  assertTierTransition,
  isTierTransitionAllowed,
  TierTransitionForbidden,
  TIER_TRANSITION_MATRIX,
  ReasonRequired,
  RowVersionMismatch,
  AuthoritativeImmutable,
} from "./domain/value-objects/index.js";
export type {
  CuratorEdit,
  CuratorEditEntityType,
  CuratorEditSource,
  CuratorEditAction,
} from "./domain/value-objects/index.js";

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
  UpdateCuratedObligation,
  CreateCuratedObligation,
  DeprecateCuratedObligation,
  RevertCuratorEdit,
  ListCuratorEdits,
  MarkStaleByArticle,
  ObligationNotFound,
  DerivedFromImmutable,
  EditNotFound,
  EditNotRevertable,
  serialiseObligation,
} from "./use-cases/index.js";
export type {
  AnswerQuestionResult,
  DerivationChain,
  ArticleHistoryEntry,
  UpdateCuratedObligationInput,
  UpdateCuratedObligationResult,
  CreateCuratedObligationCmd,
  DeprecateCuratedObligationCmd,
  RevertCuratorEditCmd,
  ListCuratorEditsInput,
  MarkStaleByArticleInput,
} from "./use-cases/index.js";

// Infrastructure
export { InMemoryPluginRegistry } from "./infrastructure/index.js";

// Legislation Plugins
export { EuAiActPlugin } from "./legislation/index.js";

// Composition
export { createContainer } from "./composition.js";
export type { ContainerDependencies } from "./composition.js";
