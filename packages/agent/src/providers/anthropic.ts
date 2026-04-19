// packages/agent/src/providers/anthropic.ts
// Translates normalised types to/from the Anthropic Messages API.

import Anthropic from "@anthropic-ai/sdk";
import type {
  CompletionProvider,
  ChatParams,
  ChatResponse,
  ChatMessage,
  ContentBlock,
  ToolDefinition,
} from "./types.js";

export class AnthropicProvider implements CompletionProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      tools: params.tools.map(toAnthropicTool),
      messages: params.messages.map(toAnthropicMessage),
    });

    return {
      content: response.content.map(fromAnthropicBlock),
      stopReason:
        response.stop_reason === "tool_use"
          ? "tool_use"
          : response.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn",
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }
}

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool["input_schema"],
  };
}

function toAnthropicMessage(msg: ChatMessage): Anthropic.MessageParam {
  if (msg.role === "tool_result") {
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: msg.toolUseId,
          content: msg.content,
        },
      ],
    };
  }
  if (msg.role === "assistant") {
    return {
      role: "assistant",
      content: msg.content.map(toAnthropicContentBlock),
    };
  }
  // user message — content is string or ContentBlock[]
  if (typeof msg.content === "string") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "user",
    content: msg.content.map(toAnthropicContentBlock),
  };
}

function toAnthropicContentBlock(
  block: ContentBlock,
): Anthropic.ContentBlockParam {
  if (block.type === "tool_use") {
    return {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: block.input,
    };
  }
  return { type: "text", text: block.text };
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentBlock {
  if (block.type === "tool_use") {
    return {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: block.input as Record<string, unknown>,
    };
  }
  // Anthropic response blocks are either "text" or "tool_use".
  // Cast to TextBlock to access the text field safely.
  return { type: "text", text: (block as Anthropic.TextBlock).text };
}
