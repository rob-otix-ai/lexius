import * as readline from "node:readline";
import type Anthropic from "@anthropic-ai/sdk";
import type { createContainer } from "@legal-ai/core";
import { createAgent } from "./agent.js";

type Container = ReturnType<typeof createContainer>;

export async function startConversation(
  container: Container,
  cleanup: () => Promise<void>,
): Promise<void> {
  const agent = createAgent(container);
  const messages: Anthropic.MessageParam[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
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
  console.log('Type "exit" or "quit" to end the conversation.');
  console.log();

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question("You: ", (answer) => {
        resolve(answer);
      });
    });

  try {
    while (true) {
      const userInput = await prompt();
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\nGoodbye!");
        break;
      }

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
    rl.close();
    await cleanup();
  }
}
