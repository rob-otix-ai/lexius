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
import { InMemoryPluginRegistry } from "./infrastructure/plugin-registry.js";
import { EuAiActPlugin } from "./legislation/eu-ai-act/index.js";
import { ClassifySystem } from "./use-cases/classify-system.js";
import { GetObligations } from "./use-cases/get-obligations.js";
import { CalculatePenalty } from "./use-cases/calculate-penalty.js";
import { SearchKnowledge } from "./use-cases/search-knowledge.js";
import { GetArticle } from "./use-cases/get-article.js";
import { GetDeadlines } from "./use-cases/get-deadlines.js";
import { AnswerQuestion } from "./use-cases/answer-question.js";
import { RunAssessment } from "./use-cases/run-assessment.js";
import { ListLegislations } from "./use-cases/list-legislations.js";

export interface ContainerDependencies {
  legislationRepo: LegislationRepository;
  articleRepo: ArticleRepository;
  riskCategoryRepo: RiskCategoryRepository;
  obligationRepo: ObligationRepository;
  penaltyRepo: PenaltyRepository;
  deadlineRepo: DeadlineRepository;
  faqRepo: FAQRepository;
  embeddingService: EmbeddingService;
}

export function createContainer(deps: ContainerDependencies) {
  const pluginRegistry = new InMemoryPluginRegistry();
  pluginRegistry.register(new EuAiActPlugin());

  return {
    classifySystem: new ClassifySystem(pluginRegistry, deps.riskCategoryRepo, deps.obligationRepo, deps.embeddingService),
    getObligations: new GetObligations(deps.obligationRepo),
    calculatePenalty: new CalculatePenalty(pluginRegistry, deps.penaltyRepo),
    searchKnowledge: new SearchKnowledge(deps.embeddingService, deps.articleRepo, deps.obligationRepo, deps.faqRepo, deps.riskCategoryRepo),
    getArticle: new GetArticle(deps.articleRepo),
    getDeadlines: new GetDeadlines(deps.deadlineRepo),
    answerQuestion: new AnswerQuestion(deps.faqRepo, deps.embeddingService),
    runAssessment: new RunAssessment(pluginRegistry),
    listLegislations: new ListLegislations(deps.legislationRepo),
    pluginRegistry,
  };
}
