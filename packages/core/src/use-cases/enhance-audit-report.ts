import type { EnhancementService } from "../domain/ports/enhancement-service.js";
import type { ComplianceReport, EnhancedComplianceReport } from "../domain/value-objects/audit.js";

export class EnhanceAuditReport {
  constructor(
    private readonly enhancementService: EnhancementService,
  ) {}

  async execute(
    report: ComplianceReport,
    systemDescription: string,
  ): Promise<EnhancedComplianceReport> {
    const enhancement = await this.enhancementService.enhance(report, systemDescription);

    return {
      ...report,
      recommendations: enhancement.recommendations.length > 0
        ? enhancement.recommendations
        : report.recommendations,
      enhancement,
    };
  }
}
