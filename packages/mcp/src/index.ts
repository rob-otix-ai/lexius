import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setup } from "./setup.js";
import { createServer } from "./server.js";
import { logger } from "./logger.js";

async function main() {
  const { container } = setup();
  const server = createServer(container);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("MCP server started (stdio)");
}

main().catch((error) => {
  logger.fatal(error, "Fatal error");
  process.exit(1);
});
