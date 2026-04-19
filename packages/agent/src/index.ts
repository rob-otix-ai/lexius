#!/usr/bin/env node
import { setup } from "./setup.js";
import { startConversation } from "./conversation.js";
import { createProvider, getDefaultModel } from "./providers/index.js";

export { createAgent, loadAgentConfig, type AgentConfig } from "./agent.js";
export { AuditAgent } from "./audit-agent.js";
export { AnthropicEnhancementService } from "./anthropic-enhancement-service.js";
export { ReasoningLoop } from "./reasoning-loop.js";
export { createProvider, getDefaultModel } from "./providers/index.js";
export type { CompletionProvider, ChatMessage, ChatResponse, ContentBlock, ToolDefinition } from "./providers/types.js";

// Swarm module
export { runSwarm, synthesise, createSwarmSession, cleanupSession } from "./swarm/index.js";
export type { SwarmResult, SwarmFinding, FindingType } from "./swarm/index.js";

async function main() {
  const args = process.argv.slice(2);
  let providerName: string | undefined;

  const providerIdx = args.indexOf("--provider");
  if (providerIdx !== -1 && args[providerIdx + 1]) {
    providerName = args[providerIdx + 1];
  }

  const provider = await createProvider(providerName);
  const model = getDefaultModel(providerName);

  const { container, config, cleanup } = await setup();
  await startConversation(container, cleanup, config, provider, model);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
