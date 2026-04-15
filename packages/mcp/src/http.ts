import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { setup } from "./setup.js";
import { createServer } from "./server.js";
import { logger } from "./logger.js";

async function main() {
  const { container } = setup();
  const mcpServer = createServer(container);

  const app = express();
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed. Use POST." }));
  });

  app.delete("/mcp", async (req, res) => {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed." }));
  });

  await mcpServer.connect(transport);

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    logger.info({ port }, "MCP server started (HTTP)");
  });
}

main().catch((error) => {
  logger.fatal(error, "Fatal error");
  process.exit(1);
});
