import type { createContainer } from "@lexius/core";
import type { AuditInput, EnhancedComplianceReport, ComplianceReport } from "@lexius/core";
import { logger } from "./logger.js";
import { AnthropicEnhancementService } from "./anthropic-enhancement-service.js";

type Container = ReturnType<typeof createContainer>;

export class AuditAgent {
  private readonly container: Container;
  private readonly enhancementService: AnthropicEnhancementService;

  constructor(container: Container) {
    this.container = container;
    this.enhancementService = new AnthropicEnhancementService();
  }

  async execute(input: AuditInput): Promise<EnhancedComplianceReport | ComplianceReport> {
    logger.info({ legislationId: input.legislationId }, "Generating audit report");
    const report = await this.container.generateAuditReport.execute(input);

    logger.info("Enhancing report");
    try {
      const enhancement = await this.enhancementService.enhance(report, input.systemDescription);
      return {
        ...report,
        recommendations: enhancement.recommendations.length > 0
          ? enhancement.recommendations
          : report.recommendations,
        enhancement,
      };
    } catch (err) {
      logger.warn({ err }, "Enhancement failed, returning base report");
      return report;
    }
  }
}
