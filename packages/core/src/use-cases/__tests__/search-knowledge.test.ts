import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchKnowledge } from "../search-knowledge.js";
import type { EmbeddingService } from "../../domain/ports/embedding-service.js";
import type {
  ArticleRepository,
  ObligationRepository,
  FAQRepository,
  RiskCategoryRepository,
} from "../../domain/ports/repositories.js";

describe("SearchKnowledge", () => {
  let mockEmbeddingService: EmbeddingService;
  let mockArticleRepo: ArticleRepository;
  let mockObligationRepo: ObligationRepository;
  let mockFaqRepo: FAQRepository;
  let mockRiskCategoryRepo: RiskCategoryRepository;
  let useCase: SearchKnowledge;

  const embedding = [0.1, 0.2, 0.3];

  beforeEach(() => {
    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue(embedding),
      embedBatch: vi.fn(),
    };

    mockArticleRepo = {
      findByLegislation: vi.fn(),
      findByNumber: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([{ item: { id: "art-1" }, similarity: 0.9 }]),
    } as unknown as ArticleRepository;

    mockObligationRepo = {
      findByFilter: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([{ item: { id: "obl-1" }, similarity: 0.8 }]),
    } as unknown as ObligationRepository;

    mockFaqRepo = {
      findByLegislation: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([{ item: { id: "faq-1" }, similarity: 0.7 }]),
    } as unknown as FAQRepository;

    mockRiskCategoryRepo = {
      findByLegislation: vi.fn(),
      findByName: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([{ item: { id: "rc-1" }, similarity: 0.85 }]),
    } as unknown as RiskCategoryRepository;

    useCase = new SearchKnowledge(
      mockEmbeddingService,
      mockArticleRepo,
      mockObligationRepo,
      mockFaqRepo,
      mockRiskCategoryRepo,
    );
  });

  it('routes to articleRepo for entityType "article"', async () => {
    const results = await useCase.execute({
      legislationId: "eu-ai-act",
      query: "biometric identification",
      limit: 5,
      entityType: "article",
    });

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("biometric identification");
    expect(mockArticleRepo.searchSemantic).toHaveBeenCalledWith("eu-ai-act", embedding, 5);
    expect(results).toHaveLength(1);
    expect((results[0].item as { id: string }).id).toBe("art-1");
  });

  it('routes to obligationRepo for entityType "obligation"', async () => {
    await useCase.execute({
      legislationId: "eu-ai-act",
      query: "risk management",
      limit: 3,
      entityType: "obligation",
    });

    expect(mockObligationRepo.searchSemantic).toHaveBeenCalledWith("eu-ai-act", embedding, 3);
  });

  it('routes to faqRepo for entityType "faq"', async () => {
    await useCase.execute({
      legislationId: "eu-ai-act",
      query: "what is high risk",
      limit: 10,
      entityType: "faq",
    });

    expect(mockFaqRepo.searchSemantic).toHaveBeenCalledWith("eu-ai-act", embedding, 10);
  });

  it('routes to riskCategoryRepo for entityType "risk-category"', async () => {
    await useCase.execute({
      legislationId: "eu-ai-act",
      query: "biometrics",
      limit: 2,
      entityType: "risk-category",
    });

    expect(mockRiskCategoryRepo.searchSemantic).toHaveBeenCalledWith("eu-ai-act", embedding, 2);
  });

  it("unknown entityType → throws", async () => {
    await expect(
      useCase.execute({
        legislationId: "eu-ai-act",
        query: "test",
        limit: 5,
        entityType: "unknown" as "article",
      }),
    ).rejects.toThrow("Unknown entity type: unknown");
  });
});
