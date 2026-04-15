import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerClassifyTool } from "./classify.js";
import { registerDeadlinesTool } from "./deadlines.js";
import { registerObligationsTool } from "./obligations.js";
import { registerFaqTool } from "./faq.js";
import { registerPenaltiesTool } from "./penalties.js";
import { registerArticlesTool } from "./articles.js";
import { registerAssessmentsTool } from "./assessments.js";
import { registerSearchTool } from "./search.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerTools(server: McpServer, container: Container): void {
  registerClassifyTool(server, container);
  registerDeadlinesTool(server, container);
  registerObligationsTool(server, container);
  registerFaqTool(server, container);
  registerPenaltiesTool(server, container);
  registerArticlesTool(server, container);
  registerAssessmentsTool(server, container);
  registerSearchTool(server, container);
}
