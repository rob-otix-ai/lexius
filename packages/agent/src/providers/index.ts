export type {
  CompletionProvider,
  ChatParams,
  ChatResponse,
  ChatMessage,
  ContentBlock,
  ToolDefinition,
} from "./types.js";

export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { OllamaProvider } from "./ollama.js";
export { MockProvider } from "./mock.js";

import type { CompletionProvider } from "./types.js";

export async function createProvider(override?: string): Promise<CompletionProvider> {
  const provider = (override || process.env.LEXIUS_MODEL_PROVIDER || "anthropic").toLowerCase();

  switch (provider) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./anthropic.js");
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    }
    case "openai": {
      const { OpenAIProvider } = await import("./openai.js");
      return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    }
    case "ollama": {
      const { OllamaProvider } = await import("./ollama.js");
      return new OllamaProvider();
    }
    case "mock": {
      const { MockProvider } = await import("./mock.js");
      return new MockProvider();
    }
    default:
      throw new Error(
        `Unknown model provider: ${provider}. Valid: anthropic, openai, ollama, mock`,
      );
  }
}

export function getDefaultModel(provider?: string): string {
  const p = provider || process.env.LEXIUS_MODEL_PROVIDER || "anthropic";
  const override = process.env.LEXIUS_MODEL;
  if (override) return override;

  switch (p) {
    case "anthropic": return process.env.ANTHROPIC_MODEL_REASONING || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    case "openai":    return "gpt-4o";
    case "ollama":    return "llama3";
    case "mock":      return "mock";
    default:          return "claude-sonnet-4-6";
  }
}
