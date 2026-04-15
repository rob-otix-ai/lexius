import Anthropic from "@anthropic-ai/sdk";
import type { ComplianceReport } from "@lexius/core";
import type { ReportEnhancement } from "@lexius/core";
import { logger } from "./logger.js";

const ENHANCEMENT_SYSTEM_PROMPT = `You are a senior AI regulatory compliance consultant. You have been given a structured compliance assessment report. Analyse it and provide:

1. An executive summary (2-3 sentences) of the key findings and their practical implications.
2. 3-5 specific, actionable recommendations tailored to this particular AI system — not generic advice. Each recommendation should reference the relevant regulation article and explain what concrete steps to take.
3. Risk areas that warrant further investigation — things that could change the assessment if more information were available.
4. Reasoning for the key conclusions — explain WHY the system was classified this way, citing specific regulation text.
5. Gap analysis — what information is missing from the assessment and how its presence would affect the conclusions.

IMPORTANT:
- Every recommendation must be actionable ("establish X documenting Y and Z") not vague ("comply with requirements")
- Distinguish between what the regulation requires and your interpretation
- Flag areas of genuine regulatory ambiguity
- If the classification seems borderline, explain both possibilities

Respond ONLY with valid JSON in this exact format:
{
  "summary": "...",
  "recommendations": ["...", "..."],
  "riskAreas": ["...", "..."],
  "reasoning": {
    "classification": "Why this risk level was determined...",
    "obligations": "Key obligation considerations...",
    "penalties": "Penalty exposure context..."
  },
  "gapAnalysis": ["...", "..."]
}`;

export class AnthropicEnhancementService {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    this.client = new Anthropic();
    this.model = process.env.ANTHROPIC_MODEL_STRUCTURED
      || process.env.ANTHROPIC_MODEL
      || "claude-sonnet-4-6";
  }

  async enhance(report: ComplianceReport, systemDescription: string): Promise<ReportEnhancement> {
    logger.debug({ model: this.model }, "Calling Anthropic for report enhancement");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: ENHANCEMENT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `AI System Description:\n${systemDescription}\n\nCompliance Assessment Report:\n${JSON.stringify(report, null, 2)}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from enhancement model");
    }

    const parsed = JSON.parse(textBlock.text);
    return {
      summary: parsed.summary || "",
      recommendations: parsed.recommendations || [],
      riskAreas: parsed.riskAreas || [],
      reasoning: parsed.reasoning || {},
      gapAnalysis: parsed.gapAnalysis || [],
    };
  }
}
