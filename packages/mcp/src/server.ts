import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { logger } from "./logger.js";
import { SERVER_NAME, SERVER_VERSION, SERVER_DISCLAIMER } from "./constants.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function createServer(container: Container): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    instructions: SERVER_DISCLAIMER,
  });

  // Wrap server.tool to add logging around each tool handler
  const originalTool = server.tool.bind(server);
  server.tool = ((...args: unknown[]) => {
    const tool = args[0] as string;
    // The handler is always the last argument
    const handler = args[args.length - 1] as (...handlerArgs: unknown[]) => Promise<unknown>;
    args[args.length - 1] = async (...handlerArgs: unknown[]) => {
      logger.info({ tool }, "Tool invoked");
      const result = await handler(...handlerArgs);
      logger.info({ tool }, "Tool completed");
      return result;
    };
    return (originalTool as (...a: unknown[]) => unknown)(...args);
  }) as typeof server.tool;

  registerTools(server, container);
  registerResources(server, container);
  registerPrompts(server);

  return server;
}
