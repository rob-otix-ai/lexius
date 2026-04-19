import type { createContainer } from "@lexius/core";
import type { AuditInput, ComplianceReport, EnhancedComplianceReport } from "@lexius/core";
import { logger } from "./logger.js";
import { AnthropicEnhancementService } from "./anthropic-enhancement-service.js";
import { handleToolCall } from "./tools.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import type {
  CompletionProvider,
  ToolDefinition,
  ChatMessage,
  ChatResponse,
} from "./providers/types.js";
import * as readline from "node:readline";

type Container = ReturnType<typeof createContainer>;

type State = "INTAKE" | "SCREENING" | "SIGNAL_GATHERING" | "REPORT_GENERATION" | "PRESENTATION";

interface AssessmentContext {
  systemDescription: string;
  role: "provider" | "deployer" | "unknown";
  signals: Record<string, unknown>;
  legislationId: string;
  annualTurnoverEur?: number;
  isSme?: boolean;
  questionsAsked: number;
  maxQuestions: number;
}

const MAX_SIGNAL_QUESTIONS = 5;

export class ReasoningLoop {
  private readonly llm: CompletionProvider;
  private readonly container: Container;
  private readonly enhancementService: AnthropicEnhancementService;
  private state: State = "INTAKE";
  private context: AssessmentContext;

  constructor(container: Container, provider?: CompletionProvider) {
    this.container = container;
    this.llm = provider ?? new AnthropicProvider();
    this.enhancementService = new AnthropicEnhancementService();
    this.context = {
      systemDescription: "",
      role: "unknown",
      signals: {},
      legislationId: "eu-ai-act",
      questionsAsked: 0,
      maxQuestions: MAX_SIGNAL_QUESTIONS,
    };
  }

  async run(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    console.log("\n=== Lexius Compliance Assessment ===\n");
    console.log("I'll guide you through a structured compliance assessment.");
    console.log("Type 'quit' at any time to exit.\n");

    try {
      while (this.state !== "PRESENTATION") {
        switch (this.state) {
          case "INTAKE": {
            const desc = await ask("Describe your AI system (what it does, who uses it, what data it processes):\n> ");
            if (desc.toLowerCase() === "quit") return;
            this.context.systemDescription = desc;

            const role = await ask("\nAre you the provider (developing/placing on market) or deployer (using under your authority)? [provider/deployer/unknown]: ");
            if (role.toLowerCase() === "quit") return;
            this.context.role = (["provider", "deployer"].includes(role.toLowerCase())
              ? role.toLowerCase()
              : "unknown") as "provider" | "deployer" | "unknown";

            const turnover = await ask("\nAnnual global turnover in EUR (press Enter to skip): ");
            if (turnover.toLowerCase() === "quit") return;
            if (turnover && !isNaN(Number(turnover))) {
              this.context.annualTurnoverEur = Number(turnover);
            }

            this.state = "SCREENING";
            break;
          }

          case "SCREENING": {
            console.log("\nScreening your system...");
            const screening = await this.container.classifySystem.execute({
              legislationId: this.context.legislationId,
              description: this.context.systemDescription,
              role: this.context.role,
            });

            logger.info({ risk: screening.riskClassification, confidence: screening.confidence }, "Initial screening");

            if (screening.riskClassification === "unacceptable") {
              console.log(`\n⚠ PROHIBITED: ${screening.matchedCategory?.name ?? "This system"} is prohibited under the regulation.`);
              this.state = "REPORT_GENERATION";
            } else if (screening.confidence === "high") {
              console.log(`\nInitial classification: ${screening.riskClassification} (high confidence)`);
              this.state = "REPORT_GENERATION";
            } else {
              console.log(`\nInitial classification: ${screening.riskClassification} (${screening.confidence} confidence)`);
              console.log("I need to ask a few more questions to improve accuracy.\n");
              this.state = "SIGNAL_GATHERING";
            }
            break;
          }

          case "SIGNAL_GATHERING": {
            // Get signal schema from plugin
            const plugin = this.container.pluginRegistry.get(this.context.legislationId);
            const schema = plugin.getSignalSchema();
            const unansweredSignals = Object.entries(schema).filter(
              ([key]) => !(key in this.context.signals),
            );

            if (unansweredSignals.length === 0 || this.context.questionsAsked >= this.context.maxQuestions) {
              this.state = "REPORT_GENERATION";
              break;
            }

            // Ask the next most important signal
            const [signalKey, signalDef] = unansweredSignals[0];

            // Check dependsOn — skip if dependency not met
            if (signalDef.dependsOn) {
              const depMet = Object.entries(signalDef.dependsOn).every(
                ([k, v]) => this.context.signals[k] === v,
              );
              if (!depMet) {
                this.context.signals[signalKey] = false;
                break;
              }
            }

            let answer: string;
            if (signalDef.type === "boolean") {
              answer = await ask(`${signalDef.question} [yes/no]: `);
              if (answer.toLowerCase() === "quit") return;
              this.context.signals[signalKey] = answer.toLowerCase().startsWith("y");
            } else if (signalDef.type === "enum" && signalDef.options) {
              answer = await ask(`${signalDef.question}\nOptions: ${signalDef.options.join(", ")}\n> `);
              if (answer.toLowerCase() === "quit") return;
              this.context.signals[signalKey] = answer.toLowerCase();
            } else {
              answer = await ask(`${signalDef.question}\n> `);
              if (answer.toLowerCase() === "quit") return;
              this.context.signals[signalKey] = answer;
            }

            this.context.questionsAsked++;

            // Re-classify after each answer
            const updated = await this.container.classifySystem.execute({
              legislationId: this.context.legislationId,
              description: this.context.systemDescription,
              role: this.context.role,
              signals: this.context.signals,
            });

            logger.debug({ risk: updated.riskClassification, confidence: updated.confidence, question: this.context.questionsAsked }, "Re-classified");

            if (updated.confidence === "high" || updated.riskClassification === "unacceptable") {
              console.log(`\nClassification refined: ${updated.riskClassification} (${updated.confidence} confidence)`);
              this.state = "REPORT_GENERATION";
            } else if (this.context.questionsAsked >= this.context.maxQuestions) {
              console.log(`\nClassification after ${this.context.questionsAsked} questions: ${updated.riskClassification} (${updated.confidence} confidence)`);
              this.state = "REPORT_GENERATION";
            }
            break;
          }

          case "REPORT_GENERATION": {
            console.log("\nGenerating compliance assessment report...\n");

            const input: AuditInput = {
              legislationId: this.context.legislationId,
              systemDescription: this.context.systemDescription,
              role: this.context.role,
              signals: Object.keys(this.context.signals).length > 0 ? this.context.signals : undefined,
              annualTurnoverEur: this.context.annualTurnoverEur,
              isSme: this.context.isSme,
            };

            const report = await this.container.generateAuditReport.execute(input);

            // Try to enhance with AI analysis
            let enhanced: EnhancedComplianceReport | ComplianceReport = report;
            try {
              const enhancement = await this.enhancementService.enhance(report, this.context.systemDescription);
              enhanced = {
                ...report,
                recommendations: enhancement.recommendations.length > 0 ? enhancement.recommendations : report.recommendations,
                enhancement,
              };
              logger.info("Report enhanced with AI analysis");
            } catch (err) {
              logger.debug({ err }, "Enhancement skipped");
            }

            this.presentReport(enhanced);
            this.state = "PRESENTATION";
            break;
          }
        }
      }

      // PRESENTATION: offer follow-ups
      console.log("\nYou can ask follow-up questions or type 'quit' to exit.\n");

      const followUpTools: ToolDefinition[] = [
        {
          name: "search_knowledge",
          description: "Search regulation text",
          inputSchema: {
            type: "object" as const,
            properties: {
              legislationId: { type: "string" },
              query: { type: "string" },
              entityType: { type: "string", enum: ["article", "obligation", "faq", "risk-category"] },
              limit: { type: "number" },
            },
            required: ["legislationId", "query", "entityType"],
          },
        },
        {
          name: "get_article",
          description: "Get a specific article",
          inputSchema: {
            type: "object" as const,
            properties: {
              legislationId: { type: "string" },
              articleNumber: { type: "string" },
            },
            required: ["legislationId", "articleNumber"],
          },
        },
      ];

      while (true) {
        const followUp = await ask("> ");
        if (followUp.toLowerCase() === "quit" || followUp.toLowerCase() === "exit") break;

        const model = process.env.ANTHROPIC_MODEL_REASONING || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

        const response = await this.llm.chat({
          model,
          maxTokens: 2048,
          temperature: 0,
          system: "You are a compliance consultant. Answer based on regulation data using the available tools. Cite article numbers.",
          tools: followUpTools,
          messages: [{ role: "user", content: followUp }],
        });

        // Handle tool call loop
        let messages: ChatMessage[] = [{ role: "user", content: followUp }];
        let currentResponse: ChatResponse = response;

        while (currentResponse.stopReason === "tool_use") {
          const assistantContent = currentResponse.content;
          messages.push({ role: "assistant", content: assistantContent });

          for (const block of assistantContent) {
            if (block.type === "tool_use") {
              const result = await handleToolCall(this.container, block.name, block.input as Record<string, unknown>);
              messages.push({
                role: "tool_result",
                toolUseId: block.id,
                content: result,
              });
            }
          }

          currentResponse = await this.llm.chat({
            model,
            maxTokens: 2048,
            temperature: 0,
            system: "You are a compliance consultant. Answer based on regulation data using the available tools. Cite article numbers.",
            tools: followUpTools,
            messages,
          });
        }

        const text = currentResponse.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("");
        if (text) console.log(`\n${text}\n`);
      }
    } finally {
      rl.close();
    }
  }

  private presentReport(report: ComplianceReport | EnhancedComplianceReport): void {
    console.log("\u2501".repeat(60));
    console.log("  COMPLIANCE ASSESSMENT REPORT");
    console.log("\u2501".repeat(60));

    // Summary (if enhanced)
    if ("enhancement" in report && report.enhancement?.summary) {
      console.log(`\n${report.enhancement.summary}\n`);
    }

    // Classification
    console.log(`\n📋 RISK CLASSIFICATION: ${report.classification.riskLevel.toUpperCase()}`);
    console.log(`   Confidence: ${report.classification.confidence}`);
    console.log(`   Basis: ${report.classification.basis}`);
    if (report.classification.matchedCategory) {
      console.log(`   Category: ${report.classification.matchedCategory}`);
    }

    // Obligations
    if (report.obligations.length > 0) {
      console.log(`\n📋 OBLIGATIONS (${report.obligations.length}):`);
      for (const o of report.obligations) {
        console.log(`   \u2022 [${o.article}] ${o.obligation}`);
      }
    }

    // Penalty
    if (report.penaltyExposure) {
      console.log(`\n💰 PENALTY EXPOSURE:`);
      console.log(`   Tier: ${report.penaltyExposure.highestTier}`);
      console.log(`   Max fine: \u20AC${report.penaltyExposure.maxFine.toLocaleString()}`);
    }

    // Assessments
    if (report.assessments.length > 0) {
      console.log(`\n🔍 ASSESSMENTS:`);
      for (const a of report.assessments) {
        console.log(`   ${a.name}: ${a.reasoning}`);
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n✅ RECOMMENDATIONS:`);
      report.recommendations.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r}`);
      });
    }

    // Gap analysis (if enhanced)
    if ("enhancement" in report && report.enhancement?.gapAnalysis?.length > 0) {
      console.log(`\n⚠ GAPS & MISSING INFORMATION:`);
      for (const gap of report.enhancement.gapAnalysis) {
        console.log(`   \u2022 ${gap}`);
      }
    }

    // Risk areas (if enhanced)
    if ("enhancement" in report && report.enhancement?.riskAreas?.length > 0) {
      console.log(`\n🔴 RISK AREAS FOR INVESTIGATION:`);
      for (const risk of report.enhancement.riskAreas) {
        console.log(`   \u2022 ${risk}`);
      }
    }

    // Confidence
    console.log(`\n📊 CONFIDENCE: ${report.confidence.overall} (signal completeness: ${Math.round(report.confidence.signalCompleteness * 100)}%)`);
    console.log(`   ${report.confidence.reasoning}`);

    console.log("\n" + "\u2501".repeat(60));
  }
}
