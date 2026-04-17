import { setup as infraSetup } from "@lexius/infra";
import { loadAgentConfig, type AgentConfig } from "./agent.js";
import { logger } from "./logger.js";

export async function setup() {
  logger.info("Setting up agent");
  const { container, pool } = infraSetup();

  const config = await loadAgentConfig(container);
  logger.info("Agent config loaded from DB — enums are deterministic");

  return {
    container,
    config,
    cleanup: async () => {
      await pool.end();
    },
  };
}
