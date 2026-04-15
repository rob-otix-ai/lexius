import { setup as infraSetup } from "@lexius/infra";
import { logger } from "./logger.js";

export async function getContainer() {
  logger.debug("Connecting to database");
  const { container, pool } = infraSetup();
  logger.debug("Container created");

  return {
    container,
    cleanup: async () => {
      await pool.end();
    },
  };
}
