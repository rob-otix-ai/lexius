import OpenAI from "openai";
import type {
  CompletionProvider,
  ChatParams,
  ChatResponse,
  ChatMessage,
  ContentBlock,
  ToolDefinition,
} from "./types.js";

export class OpenAIProvider implements CompletionProvider {
  protected client: OpenAI;

  constructor(config?: { apiKey?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: config?.apiKey,
      baseURL: config?.baseURL,
    });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      max_completion_tokens: params.maxTokens,
      temperature: params.temperature,
      messages: [
        { role: "system" as const, content: params.system },
        ...params.messages.map(toOpenAIMessage),
      ],
      tools: params.tools.length > 0 ? params.tools.map(toOpenAITool) : undefined,
      tool_choice: params.tools.length > 0 ? "auto" : undefined,
    });

    const choice = response.choices[0];
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      stopReason:
        choice.finish_reason === "tool_calls"
          ? "tool_use"
          : choice.finish_reason === "length"
            ? "max_tokens"
            : "end_turn",
      usage: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}

function toOpenAITool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as OpenAI.FunctionParameters,
    },
  };
}

function toOpenAIMessage(
  msg: ChatMessage,
): OpenAI.ChatCompletionMessageParam {
  if (msg.role === "tool_result") {
    return {
      role: "tool",
      tool_call_id: msg.toolUseId,
      content: msg.content,
    };
  }

  if (msg.role === "assistant") {
    const toolCalls = msg.content
      .filter(
        (b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use",
      )
      .map((b) => ({
        id: b.id,
        type: "function" as const,
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      }));

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return {
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  return {
    role: "user",
    content: typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("\n"),
  };
}
