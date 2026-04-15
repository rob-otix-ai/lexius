import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnswerQuestion } from "../answer-question.js";
import type { FAQRepository } from "../../domain/ports/repositories.js";
import type { EmbeddingService } from "../../domain/ports/embedding-service.js";
import type { FAQ } from "../../domain/entities/faq.js";

const sampleFaq: FAQ = {
  id: "faq-1",
  legislationId: "eu-ai-act",
  question: "What is a high-risk AI system?",
  answer: "A high-risk AI system is one listed in Annex III...",
  articleReferences: ["Article 6"],
  keywords: ["high-risk"],
  category: "classification",
  sourceUrl: null,
};

describe("AnswerQuestion", () => {
  let mockFaqRepo: FAQRepository;
  let mockEmbeddingService: EmbeddingService;

  const embedding = [0.1, 0.2, 0.3];

  beforeEach(() => {
    mockFaqRepo = {
      findByLegislation: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([]),
    } as unknown as FAQRepository;

    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue(embedding),
      embedBatch: vi.fn(),
    };
  });

  it("high similarity result → returns it", async () => {
    vi.mocked(mockFaqRepo.searchSemantic).mockResolvedValue([
      { item: sampleFaq, similarity: 0.8 },
    ]);

    const useCase = new AnswerQuestion(mockFaqRepo, mockEmbeddingService);
    const result = await useCase.execute("eu-ai-act", "What is high-risk?");

    expect(result.found).toBe(true);
    expect(result.answer).not.toBeNull();
    expect(result.answer!.item.id).toBe("faq-1");
    expect(result.answer!.similarity).toBe(0.8);
  });

  it("below threshold → returns null", async () => {
    vi.mocked(mockFaqRepo.searchSemantic).mockResolvedValue([
      { item: sampleFaq, similarity: 0.3 },
    ]);

    const useCase = new AnswerQuestion(mockFaqRepo, mockEmbeddingService);
    const result = await useCase.execute("eu-ai-act", "something unrelated");

    expect(result.found).toBe(false);
    expect(result.answer).toBeNull();
  });

  it("custom threshold works", async () => {
    vi.mocked(mockFaqRepo.searchSemantic).mockResolvedValue([
      { item: sampleFaq, similarity: 0.6 },
    ]);

    const highThreshold = new AnswerQuestion(mockFaqRepo, mockEmbeddingService, 0.7);
    const result1 = await highThreshold.execute("eu-ai-act", "query");
    expect(result1.found).toBe(false);

    const lowThreshold = new AnswerQuestion(mockFaqRepo, mockEmbeddingService, 0.5);
    const result2 = await lowThreshold.execute("eu-ai-act", "query");
    expect(result2.found).toBe(true);
  });

  it("no results from repo → returns not found", async () => {
    const useCase = new AnswerQuestion(mockFaqRepo, mockEmbeddingService);
    const result = await useCase.execute("eu-ai-act", "query");

    expect(result.found).toBe(false);
    expect(result.answer).toBeNull();
  });

  it("embeds the question text", async () => {
    const useCase = new AnswerQuestion(mockFaqRepo, mockEmbeddingService);
    await useCase.execute("eu-ai-act", "What are the penalties?");

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("What are the penalties?");
    expect(mockFaqRepo.searchSemantic).toHaveBeenCalledWith("eu-ai-act", embedding, 1);
  });
});
