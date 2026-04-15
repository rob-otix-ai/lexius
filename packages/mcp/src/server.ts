import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function createServer(container: Container): McpServer {
  const server = new McpServer({
    name: "legal-ai",
    version: "1.0.0",
  });

  registerTools(server, container);
  registerResources(server, container);
  registerPrompts(server);

  return server;
}
