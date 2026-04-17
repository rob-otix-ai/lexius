import * as readline from "node:readline";
import type Anthropic from "@anthropic-ai/sdk";
import type { createContainer } from "@lexius/core";
import { createAgent, type AgentConfig } from "./agent.js";
import { ReasoningLoop } from "./reasoning-loop.js";
import { logger } from "./logger.js";

type Container = ReturnType<typeof createContainer>;

export async function startConversation(
  container: Container,
  cleanup: () => Promise<void>,
  config?: AgentConfig,
): Promise<void> {
  logger.info("Conversation started");

  const agent = createAgent(container, config);
  const messages: Anthropic.MessageParam[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let stdinClosed = false;
  rl.on("close", () => {
    stdinClosed = true;
  });

  console.log("=".repeat(60));
  console.log("  Legal AI Compliance Assistant");
  console.log("=".repeat(60));
  console.log();
  console.log("I can help you with AI regulation compliance, including:");
  console.log("  - Classifying AI systems under risk frameworks");
  console.log("  - Finding compliance obligations by role and risk level");
  console.log("  - Calculating potential penalties for violations");
  console.log("  - Searching legislation articles and FAQs");
  console.log("  - Checking compliance deadlines");
  console.log("  - Running structured assessments");
  console.log();
  console.log("Commands:");
  console.log("  'assess' — Start a structured compliance assessment");
  console.log("  'exit'/'quit' — End the conversation");
  console.log("  Or just ask any question about AI regulation.");
  console.log();

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question("You: ", (answer) => {
        resolve(answer);
      });
    });

  try {
    while (true) {
      if (stdinClosed) {
        console.log("\nGoodbye!");
        break;
      }
      const userInput = await prompt();
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\nGoodbye!");
        break;
      }

      // Check if the input triggers the structured reasoning loop
      const assessmentTriggers = ["assess", "audit", "evaluate", "classify my system", "compliance check"];
      if (assessmentTriggers.some((cmd) => trimmed.toLowerCase().includes(cmd))) {
        const loop = new ReasoningLoop(container);
        await loop.run();
        console.log("\nBack to general Q&A. Type 'assess' to start another assessment.\n");
        continue;
      }

      logger.debug({ role: "user" }, "Message received");
      messages.push({ role: "user", content: trimmed });

      try {
        const response = await agent.chat(messages);

        // Extract text from response
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        );
        const assistantText = textBlocks.map((b) => b.text).join("\n");

        console.log();
        console.log(`Assistant: ${assistantText}`);
        console.log();

        // Append assistant response to history
        messages.push({ role: "assistant", content: response.content });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nError: ${message}\n`);
      }
    }
  } finally {
    logger.info("Conversation ended");
    rl.close();
    await cleanup();
  }
}
