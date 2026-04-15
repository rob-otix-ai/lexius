import { setup } from "./setup.js";
import { startConversation } from "./conversation.js";

export { createAgent } from "./agent.js";
export { AuditAgent } from "./audit-agent.js";

async function main() {
  const { container, cleanup } = await setup();
  await startConversation(container, cleanup);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
