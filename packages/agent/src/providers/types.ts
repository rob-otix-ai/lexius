// packages/agent/src/providers/types.ts
// Normalised types for the model harness — provider-agnostic interface.
// No dependency on any LLM SDK.

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface ChatParams {
  model: string;
  system: string;
  tools: ToolDefinition[];
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}

export type ChatMessage =
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: ContentBlock[] }
  | { role: "tool_result"; toolUseId: string; content: string };

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export interface ChatResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input: number; output: number };
}

export interface CompletionProvider {
  chat(params: ChatParams): Promise<ChatResponse>;
}
