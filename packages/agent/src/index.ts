import { setup } from "./setup.js";
import { startConversation } from "./conversation.js";

export { createAgent, loadAgentConfig, type AgentConfig } from "./agent.js";
export { AuditAgent } from "./audit-agent.js";
export { AnthropicEnhancementService } from "./anthropic-enhancement-service.js";
export { ReasoningLoop } from "./reasoning-loop.js";

async function main() {
  const { container, config, cleanup } = await setup();
  await startConversation(container, cleanup, config);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
