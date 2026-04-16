import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalculatePenalty } from "../calculate-penalty.js";
import type { LegislationPlugin, LegislationPluginRegistry } from "../../domain/plugin.js";
import type { PenaltyRepository } from "../../domain/ports/repositories.js";
import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";

describe("CalculatePenalty", () => {
  let mockPlugin: LegislationPlugin;
  let mockRegistry: LegislationPluginRegistry;
  let mockPenaltyRepo: PenaltyRepository;
  let useCase: CalculatePenalty;

  const sampleTier: Penalty = {
    id: "pen-1",
    legislationId: "eu-ai-act",
    violationType: "prohibited",
    name: "Prohibited AI practices",
    maxFineEur: 35_000_000,
    globalTurnoverPercentage: 7,
    article: "Article 99(3)",
    description: "Fines for prohibited AI practices",
    applicableTo: ["provider"],
    smeRules: null,
    provenance: {
      tier: "CURATED",
      curatedBy: "test",
      reviewedAt: new Date("2026-01-01"),
    },
    derivedFrom: [],
    extractExempt: false,
    extractExemptReason: null,
  };

  const sampleOutput: PenaltyOutput = {
    tierName: "Prohibited AI practices",
    maxFineEur: 35_000_000,
    calculatedFine: 35_000_000,
    globalTurnoverPercentage: 7,
    explanation: "Higher of...",
    smeApplied: false,
  };

  beforeEach(() => {
    mockPlugin = {
      id: "eu-ai-act",
      name: "EU AI Act",
      version: "1.0.0",
      classifyBySignals: vi.fn(),
      classifyByKeywords: vi.fn(),
      getSignalSchema: vi.fn(),
      getAssessments: vi.fn(),
      runAssessment: vi.fn(),
      calculatePenalty: vi.fn().mockReturnValue(sampleOutput),
    };

    mockRegistry = {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(mockPlugin),
      list: vi.fn(),
    };

    mockPenaltyRepo = {
      findByLegislation: vi.fn(),
      findByViolationType: vi.fn().mockResolvedValue(sampleTier),
    };

    useCase = new CalculatePenalty(mockRegistry, mockPenaltyRepo);
  });

  it("calls repo findByViolationType and delegates to plugin.calculatePenalty", async () => {
    const result = await useCase.execute({
      legislationId: "eu-ai-act",
      violationType: "prohibited",
      annualTurnoverEur: 500_000_000,
      isSme: false,
    });

    expect(mockPenaltyRepo.findByViolationType).toHaveBeenCalledWith("eu-ai-act", "prohibited");
    expect(mockPlugin.calculatePenalty).toHaveBeenCalledWith(sampleTier, 500_000_000, false);
    expect(result).toBe(sampleOutput);
  });

  it("passes isSme default false when not provided", async () => {
    await useCase.execute({
      legislationId: "eu-ai-act",
      violationType: "prohibited",
      annualTurnoverEur: 100_000_000,
    });

    expect(mockPlugin.calculatePenalty).toHaveBeenCalledWith(sampleTier, 100_000_000, false);
  });

  it("violation type not found → throws", async () => {
    vi.mocked(mockPenaltyRepo.findByViolationType).mockResolvedValue(null);

    await expect(
      useCase.execute({
        legislationId: "eu-ai-act",
        violationType: "nonexistent",
        annualTurnoverEur: 100_000_000,
      }),
    ).rejects.toThrow("No penalty tier found for violation type: nonexistent");
  });
});
