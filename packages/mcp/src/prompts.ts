import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "classify-my-system",
    "Walk through classifying an AI system under the EU AI Act",
    {
      description: z
        .string()
        .optional()
        .describe("Brief description of the AI system"),
      role: z
        .enum(["provider", "deployer", "unknown"])
        .optional()
        .describe("Your role with respect to the AI system"),
    },
    (args) => {
      const desc = args.description
        ? `The user describes their AI system as: "${args.description}".`
        : "Ask the user to describe their AI system.";
      const role = args.role
        ? `Their role is: ${args.role}.`
        : "Ask whether they are a provider or deployer.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "I need help classifying my AI system under the EU AI Act.",
                desc,
                role,
                "",
                "Please use the legalai_classify_system tool to determine the risk level,",
                "then explain the classification and what obligations apply.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  server.prompt(
    "compliance-checklist",
    "Generate a compliance checklist for a given role and risk level",
    {
      role: z
        .enum(["provider", "deployer"])
        .describe("Your role"),
      riskLevel: z
        .string()
        .describe("Risk level (e.g. high, limited, minimal)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `I am a ${args.role} of a ${args.riskLevel}-risk AI system under the EU AI Act.`,
              "",
              "Please use legalai_get_obligations and legalai_check_deadlines to:",
              "1. List all my obligations",
              "2. Show upcoming deadlines",
              "3. Create a prioritised compliance checklist with dates",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "penalty-risk-assessment",
    "Assess potential penalties for non-compliance",
    {
      violationType: z
        .string()
        .describe("Type of violation to assess"),
      annualTurnoverEur: z
        .string()
        .describe("Annual global turnover in EUR"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Assess the penalty risk for a "${args.violationType}" violation.`,
              `Our annual turnover is EUR ${Number(args.annualTurnoverEur)}.`,
              "",
              "Please use legalai_calculate_penalty to compute the potential fine,",
              "then explain the penalty tier, how the fine was calculated,",
              "and what steps we should take to mitigate this risk.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "ground-citation",
    "Ground a claim with citations from the legislation",
    {
      claim: z.string().describe("The claim or statement to verify"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Please verify and ground the following claim with specific article citations:`,
              "",
              `"${args.claim}"`,
              "",
              "Use legalai_search_knowledge to find relevant articles and obligations,",
              "then use legalai_get_article to retrieve the full text of each cited article.",
              "Present the evidence with exact article references.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
