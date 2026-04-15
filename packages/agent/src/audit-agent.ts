import Anthropic from "@anthropic-ai/sdk";
import type { createContainer } from "@lexius/core";
import type { AuditInput, ComplianceReport } from "@lexius/core";
import { logger } from "./logger.js";

type Container = ReturnType<typeof createContainer>;

const ENHANCE_PROMPT = `You are a regulatory compliance expert. You have been given a structured compliance assessment report for an AI system. Your job is to:

1. Write a 2-3 sentence executive summary of the findings.
2. Provide 3-5 specific, actionable recommendations tailored to this particular system (not generic advice).
3. Identify any risk areas that warrant further investigation.

Respond in JSON format:
{
  "summary": "...",
  "recommendations": ["...", "..."],
  "riskAreas": ["...", "..."]
}`;

export class AuditAgent {
  private readonly client: Anthropic;
  private readonly container: Container;

  constructor(container: Container, anthropicApiKey?: string) {
    this.container = container;
    this.client = new Anthropic({ apiKey: anthropicApiKey });
  }

  async execute(input: AuditInput): Promise<ComplianceReport & { summary?: string; riskAreas?: string[] }> {
    // Step 1: Get deterministic report
    logger.info({ legislationId: input.legislationId }, "Generating audit report");
    const report = await this.container.generateAuditReport.execute(input);

    // Step 2: Enhance with Claude
    logger.debug("Enhancing report with Claude");
    try {
      const response = await this.client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `${ENHANCE_PROMPT}\n\nReport:\n${JSON.stringify(report, null, 2)}`,
        }],
      });

      const textBlock = response.content.find(b => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const enhanced = JSON.parse(textBlock.text);
        return {
          ...report,
          summary: enhanced.summary,
          recommendations: enhanced.recommendations || report.recommendations,
          riskAreas: enhanced.riskAreas,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Failed to enhance report with Claude, returning base report");
    }

    return report;
  }
}
