import type {
  LegislationRepository,
  ArticleRepository,
  RiskCategoryRepository,
  ObligationRepository,
  PenaltyRepository,
  DeadlineRepository,
  FAQRepository,
} from "./domain/ports/repositories.js";
import type { ArticleRevisionRepository } from "./domain/ports/article-revision.repository.js";
import type { ArticleExtractRepository } from "./domain/ports/article-extract.repository.js";
import type { EmbeddingService } from "./domain/ports/embedding-service.js";
import type { EnhancementService } from "./domain/ports/enhancement-service.js";
import { InMemoryPluginRegistry } from "./infrastructure/plugin-registry.js";
import { EuAiActPlugin } from "./legislation/eu-ai-act/index.js";
import { DoraPlugin } from "./legislation/dora/index.js";
import { GenericPlugin } from "./legislation/generic/index.js";
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
import { GetDerivationChain } from "./use-cases/get-derivation-chain.js";
import { GetArticleHistory } from "./use-cases/get-article-history.js";
import { GetArticleExtracts } from "./use-cases/get-article-extracts.js";

export interface ContainerDependencies {
  legislationRepo: LegislationRepository;
  articleRepo: ArticleRepository;
  articleRevisionRepo: ArticleRevisionRepository;
  articleExtractRepo: ArticleExtractRepository;
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
  pluginRegistry.register(new GenericPlugin("gdpr", "General Data Protection Regulation (Regulation 2016/679)"));
  pluginRegistry.register(new GenericPlugin("digital-services-act", "Digital Services Act (Regulation 2022/2065)"));
  pluginRegistry.register(new GenericPlugin("digital-markets-act", "Digital Markets Act (Regulation 2022/1925)"));
  pluginRegistry.register(new GenericPlugin("data-act", "Data Act (Regulation 2023/2854)"));
  pluginRegistry.register(new GenericPlugin("data-governance-act", "Data Governance Act (Regulation 2022/868)"));
  pluginRegistry.register(new GenericPlugin("cyber-resilience-act", "Cyber Resilience Act (Regulation 2024/2847)"));
  pluginRegistry.register(new GenericPlugin("mica", "Markets in Crypto-Assets Regulation (Regulation 2023/1114)"));
  pluginRegistry.register(new GenericPlugin("eidas2", "European Digital Identity Regulation (Regulation 2024/1183)"));
  pluginRegistry.register(new GenericPlugin("cima-monetary-authority", "Monetary Authority Act (2020 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-banks-trust", "Banks and Trust Companies Act (2025 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-mutual-funds", "Mutual Funds Act (2025 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-private-funds", "Private Funds Act (2025 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-securities", "Securities Investment Business Act (2020 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-insurance", "Insurance Act (2010)"));
  pluginRegistry.register(new GenericPlugin("cima-aml", "Anti-Money Laundering Regulations (2025 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-vasp", "Virtual Asset (Service Providers) Act (2024 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-proceeds-crime", "Proceeds of Crime Act (2024 Revision)"));
  pluginRegistry.register(new GenericPlugin("cima-beneficial-ownership", "Beneficial Ownership Transparency Act (2023)"));

  const classifySystem = new ClassifySystem(pluginRegistry, deps.riskCategoryRepo, deps.obligationRepo, deps.embeddingService);
  const getObligations = new GetObligations(deps.obligationRepo);
  const calculatePenalty = new CalculatePenalty(pluginRegistry, deps.penaltyRepo);
  const searchKnowledge = new SearchKnowledge(deps.embeddingService, deps.articleRepo, deps.obligationRepo, deps.faqRepo, deps.riskCategoryRepo);
  const getArticle = new GetArticle(deps.articleRepo);
  const getDeadlines = new GetDeadlines(deps.deadlineRepo);
  const runAssessment = new RunAssessment(pluginRegistry);
  const getDerivationChain = new GetDerivationChain(deps.obligationRepo, deps.articleRepo);
  const getArticleHistory = new GetArticleHistory(deps.articleRepo, deps.articleRevisionRepo);
  const getArticleExtracts = new GetArticleExtracts(deps.articleExtractRepo);

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
    getDerivationChain,
    getArticleHistory,
    getArticleExtracts,
    penaltyRepo: deps.penaltyRepo,
    deadlineRepo: deps.deadlineRepo,
    pluginRegistry,
  };
}
