import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setup } from "./setup.js";
import { createServer } from "./server.js";

async function main() {
  const { container } = setup();
  const server = createServer(container);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
