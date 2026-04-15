import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClassifySystem } from "../classify-system.js";
import type { LegislationPlugin, LegislationPluginRegistry } from "../../domain/plugin.js";
import type { RiskCategoryRepository, ObligationRepository } from "../../domain/ports/repositories.js";
import type { EmbeddingService } from "../../domain/ports/embedding-service.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";

function makeSignalResult(overrides: Partial<ClassifyOutput> = {}): ClassifyOutput {
  return {
    riskClassification: "high",
    confidence: "high",
    matchedCategory: { name: "Test Category", level: 4 },
    relevantArticles: ["Article 6(2)"],
    roleDetermination: "provider",
    obligationsSummary: "High-risk obligations apply.",
    matchedSignals: ["domain"],
    missingSignals: [],
    nextQuestions: [],
    basis: "signals",
    ...overrides,
  };
}

function makeKeywordResult(overrides: Partial<ClassifyOutput> = {}): ClassifyOutput {
  return {
    riskClassification: "high",
    confidence: "medium",
    matchedCategory: { name: "Keyword Category", level: 4 },
    relevantArticles: ["Article 6(2)"],
    roleDetermination: "unknown",
    obligationsSummary: "Matched by keywords.",
    matchedSignals: [],
    missingSignals: [],
    nextQuestions: [],
    basis: "text",
    ...overrides,
  };
}

describe("ClassifySystem", () => {
  let mockPlugin: LegislationPlugin;
  let mockRegistry: LegislationPluginRegistry;
  let mockRiskCategoryRepo: RiskCategoryRepository;
  let mockObligationRepo: ObligationRepository;
  let mockEmbeddingService: EmbeddingService;
  let useCase: ClassifySystem;

  beforeEach(() => {
    mockPlugin = {
      id: "eu-ai-act",
      name: "EU AI Act",
      version: "1.0.0",
      classifyBySignals: vi.fn().mockReturnValue(null),
      classifyByKeywords: vi.fn().mockReturnValue(null),
      getSignalSchema: vi.fn(),
      getAssessments: vi.fn(),
      runAssessment: vi.fn(),
      calculatePenalty: vi.fn(),
    };

    mockRegistry = {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(mockPlugin),
      list: vi.fn(),
    };

    mockRiskCategoryRepo = {
      findByLegislation: vi.fn().mockResolvedValue([]),
      findByName: vi.fn(),
      searchSemantic: vi.fn().mockResolvedValue([]),
    } as unknown as RiskCategoryRepository;

    mockObligationRepo = {
      findByFilter: vi.fn(),
      searchSemantic: vi.fn(),
    } as unknown as ObligationRepository;

    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embedBatch: vi.fn(),
    };

    useCase = new ClassifySystem(
      mockRegistry,
      mockRiskCategoryRepo,
      mockObligationRepo,
      mockEmbeddingService,
    );
  });

  it("signal classification returns result → returns it without calling keyword or semantic", async () => {
    const signalResult = makeSignalResult();
    vi.mocked(mockPlugin.classifyBySignals).mockReturnValue(signalResult);

    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      role: "provider",
      signals: { domain: "employment" },
    });

    expect(result).toBe(signalResult);
    expect(mockPlugin.classifyByKeywords).not.toHaveBeenCalled();
    expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
  });

  it("signals return null, keywords match → returns keyword result", async () => {
    const keywordResult = makeKeywordResult();
    vi.mocked(mockPlugin.classifyByKeywords).mockReturnValue(keywordResult);

    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      role: "provider",
      description: "facial recognition system",
      signals: { domain: "other" },
    });

    expect(result).toBe(keywordResult);
    expect(mockPlugin.classifyBySignals).toHaveBeenCalled();
    expect(mockPlugin.classifyByKeywords).toHaveBeenCalled();
  });

  it("both null, semantic match → returns semantic result", async () => {
    vi.mocked(mockRiskCategoryRepo.searchSemantic).mockResolvedValue([
      {
        item: {
          id: "rc-1",
          legislationId: "eu-ai-act",
          name: "Biometric identification",
          level: 4,
          description: "Biometric systems",
          keywords: [],
          examples: [],
          relevantArticles: ["Article 6(2)"],
        },
        similarity: 0.85,
      },
    ]);

    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      role: "provider",
      description: "a biometric identification system",
    });

    expect(result.basis).toBe("semantic");
    expect(result.riskClassification).toBe("Biometric identification");
    expect(result.confidence).toBe("high");
  });

  it("all null → returns default insufficient_information", async () => {
    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      role: "unknown",
      description: "something vague",
    });

    expect(result.riskClassification).toBe("insufficient_information");
    expect(result.confidence).toBe("low");
    expect(result.basis).toBe("default");
    expect(result.nextQuestions.length).toBeGreaterThan(0);
  });

  it("no description, no signals → returns default", async () => {
    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      role: "unknown",
    });

    expect(result.riskClassification).toBe("insufficient_information");
    expect(result.basis).toBe("default");
  });

  it("plugin not found → throws", async () => {
    vi.mocked(mockRegistry.get).mockImplementation(() => {
      throw new Error("No plugin registered for legislation: unknown");
    });

    await expect(
      useCase.execute({ legislationId: "unknown", role: "provider" }),
    ).rejects.toThrow("No plugin registered for legislation: unknown");
  });
});
