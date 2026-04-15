import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateAuditReport } from "../generate-audit-report.js";
import type { ClassifySystem } from "../classify-system.js";
import type { GetObligations } from "../get-obligations.js";
import type { CalculatePenalty } from "../calculate-penalty.js";
import type { RunAssessment } from "../run-assessment.js";
import type { GetDeadlines } from "../get-deadlines.js";
import type { GetArticle } from "../get-article.js";
import type { SearchKnowledge } from "../search-knowledge.js";
import type { LegislationPluginRegistry, LegislationPlugin } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";
import type { AuditInput, ComplianceReport } from "../../domain/value-objects/audit.js";

function makeClassification(overrides: Partial<ClassifyOutput> = {}): ClassifyOutput {
  return {
    riskClassification: "high",
    confidence: "high",
    matchedCategory: { name: "Biometric identification", level: 4 },
    relevantArticles: ["Article 6(2)"],
    roleDetermination: "provider",
    obligationsSummary: "High-risk obligations apply.",
    matchedSignals: ["domain"],
    missingSignals: ["training_data_size"],
    nextQuestions: [],
    basis: "signals",
    ...overrides,
  };
}

function makeObligation(overrides: Partial<{ id: string; legislationId: string; role: string; riskLevel: string; obligation: string; article: string; deadline: Date | null; details: string; category: string }> = {}) {
  return {
    id: "obl-1",
    legislationId: "eu-ai-act",
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Establish risk management system",
    article: "Article 9",
    deadline: new Date("2026-08-02T00:00:00.000Z"),
    details: "Ongoing risk management",
    category: "risk-management",
    ...overrides,
  };
}

describe("GenerateAuditReport", () => {
  let mockClassifySystem: ClassifySystem;
  let mockGetObligations: GetObligations;
  let mockCalculatePenalty: CalculatePenalty;
  let mockRunAssessment: RunAssessment;
  let mockGetDeadlines: GetDeadlines;
  let mockGetArticle: GetArticle;
  let mockSearchKnowledge: SearchKnowledge;
  let mockPlugin: LegislationPlugin;
  let mockPluginRegistry: LegislationPluginRegistry;
  let useCase: GenerateAuditReport;

  const defaultInput: AuditInput = {
    legislationId: "eu-ai-act",
    systemDescription: "A facial recognition system for border control",
    role: "provider",
    signals: { domain: "biometric", purpose: "identification" },
    annualTurnoverEur: 50_000_000,
    isSme: false,
  };

  beforeEach(() => {
    mockClassifySystem = {
      execute: vi.fn().mockResolvedValue(makeClassification()),
    } as unknown as ClassifySystem;

    mockGetObligations = {
      execute: vi.fn().mockResolvedValue([makeObligation()]),
    } as unknown as GetObligations;

    mockCalculatePenalty = {
      execute: vi.fn().mockResolvedValue({
        tierName: "High-risk violations",
        maxFineEur: 15_000_000,
        calculatedFine: 15_000_000,
        globalTurnoverPercentage: 3,
        explanation: "3% of global annual turnover or EUR 15 million, whichever is higher.",
        smeApplied: false,
      }),
    } as unknown as CalculatePenalty;

    mockRunAssessment = {
      execute: vi.fn().mockReturnValue({
        assessmentId: "art6-exception",
        result: { eligible: false },
        reasoning: "System is listed in Annex III directly.",
        relevantArticles: ["Article 6(3)"],
      }),
    } as unknown as RunAssessment;

    mockGetDeadlines = {
      execute: vi.fn().mockResolvedValue({
        deadlines: [
          {
            id: "dl-1",
            legislationId: "eu-ai-act",
            date: new Date("2026-08-02T00:00:00.000Z"),
            event: "High-risk AI systems compliance deadline",
            description: "Deadline for high-risk systems",
            daysRemaining: 109,
            isPast: false,
          },
        ],
        nextMilestone: null,
      }),
    } as unknown as GetDeadlines;

    mockGetArticle = {
      execute: vi.fn().mockImplementation((_legId: string, number: string) => {
        if (number.startsWith("doc-")) {
          const itemNum = parseInt(number.split("-")[1], 10);
          if (itemNum >= 1 && itemNum <= 9) {
            return Promise.resolve({
              id: `art-${number}`,
              legislationId: "eu-ai-act",
              number,
              title: `Documentation Item ${itemNum}`,
              summary: `Technical documentation requirement ${itemNum}`,
              fullText: "",
              sourceUrl: null,
              relatedAnnexes: [],
            });
          }
        }
        return Promise.resolve(null);
      }),
    } as unknown as GetArticle;

    mockSearchKnowledge = {
      execute: vi.fn().mockResolvedValue([
        {
          item: {
            id: "art-6",
            legislationId: "eu-ai-act",
            number: "Article 6",
            title: "Classification rules for high-risk AI systems",
            summary: "Sets out when AI systems are high-risk.",
            fullText: "",
            sourceUrl: "https://eur-lex.europa.eu/article-6",
            relatedAnnexes: [],
          },
          similarity: 0.9,
        },
      ]),
    } as unknown as SearchKnowledge;

    mockPlugin = {
      id: "eu-ai-act",
      name: "EU AI Act",
      version: "1.0.0",
      classifyBySignals: vi.fn(),
      classifyByKeywords: vi.fn(),
      getSignalSchema: vi.fn().mockReturnValue({
        domain: { type: "enum", options: ["biometric", "employment"], question: "Domain?" },
        purpose: { type: "enum", options: ["identification", "categorization"], question: "Purpose?" },
        training_data_size: { type: "string", question: "Training data size?" },
        profiling: { type: "boolean", question: "Profiling?" },
        training_flops: { type: "string", question: "Training FLOPS?" },
      }),
      getAssessments: vi.fn().mockReturnValue([
        { id: "art6-exception", name: "Exception Assessment", description: "Test", inputSchema: {} },
        { id: "systemic-risk", name: "Systemic Risk Assessment", description: "Test", inputSchema: {} },
      ]),
      runAssessment: vi.fn(),
      calculatePenalty: vi.fn(),
    };

    mockPluginRegistry = {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(mockPlugin),
      list: vi.fn(),
    };

    useCase = new GenerateAuditReport(
      mockClassifySystem,
      mockGetObligations,
      mockCalculatePenalty,
      mockRunAssessment,
      mockGetDeadlines,
      mockGetArticle,
      mockSearchKnowledge,
      mockPluginRegistry,
    );
  });

  it("produces a complete report with all sections", async () => {
    const report = await useCase.execute(defaultInput);

    expect(report.metadata.legislationId).toBe("eu-ai-act");
    expect(report.metadata.legislationName).toBe("EU AI Act");
    expect(report.metadata.reportVersion).toBe("1.0.0");
    expect(report.metadata.generatedAt).toBeTruthy();

    expect(report.systemDescription).toBe(defaultInput.systemDescription);

    expect(report.classification.riskLevel).toBe("high");
    expect(report.classification.confidence).toBe("high");
    expect(report.classification.basis).toBe("signals");
    expect(report.classification.matchedCategory).toBe("Biometric identification");
    expect(report.classification.matchedSignals).toContain("domain");

    expect(report.obligations).toHaveLength(1);
    expect(report.obligations[0].obligation).toBe("Establish risk management system");
    expect(report.obligations[0].article).toBe("Article 9");

    expect(report.penaltyExposure).not.toBeNull();
    expect(report.penaltyExposure!.highestTier).toBe("High-risk violations");
    expect(report.penaltyExposure!.maxFine).toBe(15_000_000);

    expect(report.documentationChecklist).not.toBeNull();
    expect(report.documentationChecklist!.length).toBe(9);

    expect(report.deadlines).toHaveLength(1);
    expect(report.deadlines[0].daysRemaining).toBe(109);

    expect(report.citations).toHaveLength(1);
    expect(report.citations[0].article).toBe("Article 6");

    expect(report.recommendations.length).toBeGreaterThan(0);

    expect(report.confidence.overall).toBe("medium");
    expect(report.confidence.signalCompleteness).toBe(0.4);
  });

  it("high-risk classification includes obligations and documentation checklist", async () => {
    const report = await useCase.execute(defaultInput);

    expect(report.classification.riskLevel).toBe("high");
    expect(report.obligations.length).toBeGreaterThan(0);
    expect(report.documentationChecklist).not.toBeNull();
    expect(report.documentationChecklist!.length).toBe(9);
  });

  it("prohibited classification includes correct recommendations", async () => {
    vi.mocked(mockClassifySystem.execute).mockResolvedValue(
      makeClassification({ riskClassification: "unacceptable" }),
    );

    const report = await useCase.execute(defaultInput);

    expect(report.recommendations).toContain("This system is prohibited. Do not deploy.");
    expect(report.recommendations).toContain("Consult legal counsel for narrow exceptions.");
    expect(report.recommendations).toContain("If deployed, initiate immediate withdrawal.");
  });

  it("no turnover means penaltyExposure is null", async () => {
    const inputWithoutTurnover: AuditInput = {
      ...defaultInput,
      annualTurnoverEur: undefined,
    };

    const report = await useCase.execute(inputWithoutTurnover);

    expect(report.penaltyExposure).toBeNull();
    expect(mockCalculatePenalty.execute).not.toHaveBeenCalled();
  });

  it("confidence calculation based on signal completeness", async () => {
    // 2 signals out of 5 → 0.4 → medium
    const report = await useCase.execute(defaultInput);
    expect(report.confidence.signalCompleteness).toBe(0.4);
    expect(report.confidence.overall).toBe("medium");

    // Correction: 2/5 = 0.4 which is the boundary. Let's verify the exact threshold.
    // >= 0.4 is medium, so 0.4 should be medium.
    expect(report.confidence.reasoning).toBe(
      "Some signals provided. Classification may change with additional information.",
    );
  });

  it("no signals yields low confidence", async () => {
    const inputWithoutSignals: AuditInput = {
      legislationId: "eu-ai-act",
      systemDescription: "Some AI system",
      role: "unknown",
    };

    const report = await useCase.execute(inputWithoutSignals);

    expect(report.confidence.overall).toBe("low");
    expect(report.confidence.signalCompleteness).toBe(0);
    expect(report.confidence.reasoning).toContain("Few or no signals provided");
  });

  it("high signal completeness yields high confidence", async () => {
    const inputWithManySignals: AuditInput = {
      ...defaultInput,
      signals: {
        domain: "biometric",
        purpose: "identification",
        training_data_size: "large",
        profiling: false,
        training_flops: "1e25",
      },
    };

    // 5/5 = 1.0 → high
    const report = await useCase.execute(inputWithManySignals);
    expect(report.confidence.overall).toBe("high");
    expect(report.confidence.signalCompleteness).toBe(1);
  });

  it("minimal risk does not include Annex IV checklist", async () => {
    vi.mocked(mockClassifySystem.execute).mockResolvedValue(
      makeClassification({ riskClassification: "minimal" }),
    );

    const report = await useCase.execute(defaultInput);

    expect(report.documentationChecklist).toBeNull();
    expect(mockGetArticle.execute).not.toHaveBeenCalled();
  });

  it("disabling options skips corresponding sections", async () => {
    const input: AuditInput = {
      ...defaultInput,
      options: {
        includeDocumentation: false,
        includeDeadlines: false,
        includePenalties: false,
        includeRecommendations: false,
      },
    };

    const report = await useCase.execute(input);

    expect(report.documentationChecklist).toBeNull();
    expect(report.deadlines).toEqual([]);
    expect(report.penaltyExposure).toBeNull();
    expect(report.recommendations).toEqual([]);
  });

  it("runs all available assessments from the plugin", async () => {
    const report = await useCase.execute(defaultInput);

    // Plugin defines 2 assessments, both should be attempted
    expect(mockRunAssessment.execute).toHaveBeenCalledTimes(2);
    expect(report.assessments).toHaveLength(2);
  });

  it("handles assessment errors gracefully", async () => {
    vi.mocked(mockRunAssessment.execute).mockImplementation(() => {
      throw new Error("Assessment not found");
    });

    const input: AuditInput = {
      ...defaultInput,
      signals: { domain: "biometric", profiling: true, training_flops: "1e25" },
    };

    const report = await useCase.execute(input);

    expect(report.assessments).toEqual([]);
  });

  it("handles penalty calculation errors gracefully", async () => {
    vi.mocked(mockCalculatePenalty.execute).mockRejectedValue(
      new Error("No penalty tier found"),
    );

    const report = await useCase.execute(defaultInput);

    expect(report.penaltyExposure).toBeNull();
  });

  it("snapshot: full report output structure", async () => {
    // Use a fixed date for snapshot stability
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));

    const report = await useCase.execute(defaultInput);

    expect(report).toMatchSnapshot();

    vi.useRealTimers();
  });
});
