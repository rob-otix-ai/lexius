import type {
  LegislationRepository,
  ArticleRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
} from "./domain/ports/repositories.js";
import type { EmbeddingService } from "./domain/ports/embedding-service.js";
import type { EnhancementService } from "./domain/ports/enhancement-service.js";
import { InMemoryPluginRegistry } from "./infrastructure/plugin-registry.js";
import { EuAiActPlugin } from "./legislation/eu-ai-act/index.js";
import { DoraPlugin } from "./legislation/dora/index.js";
import { ClassifySystem } from "./use-cases/classify-system.js";
import { GetObligations } from "./use-cases/get-obligations.js";
import { CalculatePenalty } from "./use-cases/calculate-penalty.js";
import { SearchKnowledge } from "./use-cases/search-knowledge.js";
import { GetArticle } from "./use-cases/get-article.js";
import { GetDeadlines } from "./use-cases/get-deadlines.js";
import { AnswerQuestion } from "./use-cases/answer-question.js";
import { RunAssessment } from "./use-cases/run-assessment.js";
import { ListLegislations } from "./use-cases/list-legislations.js";
import { GenerateAuditReport } from "./use-cases/generate-audit-report.js";
import { EnhanceAuditReport } from "./use-cases/enhance-audit-report.js";

export interface ContainerDependencies {
  legislationRepo: LegislationRepository;
  articleRepo: ArticleRepository;
  riskCategoryRepo: RiskCategoryRepository;
  obligationRepo: ObligationRepository;
  penaltyRepo: PenaltyRepository;
  deadlineRepo: DeadlineRepository;
  faqRepo: FAQRepository;
  embeddingService: EmbeddingService;
  reportEnhancementService?: EnhancementService;
}

export function createContainer(deps: ContainerDependencies) {
  const pluginRegistry = new InMemoryPluginRegistry();
  pluginRegistry.register(new EuAiActPlugin());
  pluginRegistry.register(new DoraPlugin());

  const classifySystem = new ClassifySystem(pluginRegistry, deps.riskCategoryRepo, deps.obligationRepo, deps.embeddingService);
  const getObligations = new GetObligations(deps.obligationRepo);
  const calculatePenalty = new CalculatePenalty(pluginRegistry, deps.penaltyRepo);
  const searchKnowledge = new SearchKnowledge(deps.embeddingService, deps.articleRepo, deps.obligationRepo, deps.faqRepo, deps.riskCategoryRepo);
  const getArticle = new GetArticle(deps.articleRepo);
  const getDeadlines = new GetDeadlines(deps.deadlineRepo);
  const runAssessment = new RunAssessment(pluginRegistry);

  const enhanceAuditReport = deps.reportEnhancementService
    ? new EnhanceAuditReport(deps.reportEnhancementService)
    : null;

  const generateAuditReport = new GenerateAuditReport(
    classifySystem,
    getObligations,
    calculatePenalty,
    runAssessment,
    getDeadlines,
    getArticle,
    searchKnowledge,
    pluginRegistry,
  );

  return {
    classifySystem,
    getObligations,
    calculatePenalty,
    searchKnowledge,
    getArticle,
    getDeadlines,
    answerQuestion: new AnswerQuestion(deps.faqRepo, deps.embeddingService),
    runAssessment,
    listLegislations: new ListLegislations(deps.legislationRepo),
    generateAuditReport,
    enhanceAuditReport,
    pluginRegistry,
  };
}
