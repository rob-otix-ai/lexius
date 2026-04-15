import { setup as infraSetup } from "@lexius/infra";
import { logger } from "./logger.js";

export function setup() {
  logger.info("Setting up MCP server");
  const { container, pool } = infraSetup();
  logger.info("Service container created");
  return { container, pool };
}
