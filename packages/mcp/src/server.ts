import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { logger } from "./logger.js";
import { SERVER_NAME, SERVER_VERSION, SERVER_DISCLAIMER } from "./constants.js";
import { resolveCurrentRole } from "./role.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function createServer(container: Container): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DISCLAIMER,
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

  // Role-aware tool registration (C-AUTH-003). Read tools are always
  // registered. Curator tools are only registered when the loaded credential
  // carries role === "curator"; otherwise they're absent from tools/list and
  // the model cannot attempt to call them. v1 has no curator tools yet —
  // this branch is scaffolded for v1.1.
  const role = resolveCurrentRole();
  logger.info({ role }, "MCP tool registration by role");

  registerTools(server, container);
  if (role === "curator") {
    // registerCuratorTools(server, container);  // v1.1
  }

  registerResources(server, container);
  registerPrompts(server);

  return server;
}
