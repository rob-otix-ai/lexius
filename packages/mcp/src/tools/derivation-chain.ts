import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerDerivationChainTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_get_derivation_chain",
    "Retrieve the source articles an obligation derives from. Returns the obligation ID and the verbatim source articles it paraphrases.",
    {
      obligationId: z.string().describe("Obligation identifier (e.g. 'eu-ai-act-obl-provider-hr-risk-mgmt')"),
    },
    async (args) => {
      try {
        const chain = await container.getDerivationChain.execute(args.obligationId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(chain, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: (err as Error).message,
              }),
            },
          ],
        };
      }
    },
  );
}
