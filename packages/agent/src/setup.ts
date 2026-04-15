import { setup as infraSetup } from "@lexius/infra";
import { logger } from "./logger.js";

export function setup() {
  logger.info("Setting up agent");
  const { container, pool } = infraSetup();
  logger.info("Agent container created");

  return {
    container,
    cleanup: async () => {
      await pool.end();
    },
  };
}
