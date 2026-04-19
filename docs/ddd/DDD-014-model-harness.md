# DDD-014: Model Harness — Implementation

## Status: Draft
## Date: 2026-04-19

---

## Overview

Implementation details for PRD-011 / ARD-015. Covers: normalised types, three provider implementations, factory, agent refactor, mock for testing, and the Specflow contract.

## Normalised Types

```typescript
// packages/agent/src/providers/types.ts

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
```

## AnthropicProvider

```typescript
// packages/agent/src/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { CompletionProvider, ChatParams, ChatResponse, ChatMessage, ContentBlock, ToolDefinition } from "./types.js";

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
      stopReason: response.stop_reason === "tool_use" ? "tool_use"
        : response.stop_reason === "max_tokens" ? "max_tokens"
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
      content: [{
        type: "tool_result",
        tool_use_id: msg.toolUseId,
        content: msg.content,
      }],
    };
  }
  if (msg.role === "assistant") {
    return {
      role: "assistant",
      content: msg.content.map(toAnthropicContentBlock),
    };
  }
  return { role: "user", content: msg.content as string };
}

function toAnthropicContentBlock(block: ContentBlock): Anthropic.ContentBlockParam {
  if (block.type === "tool_use") {
    return { type: "tool_use", id: block.id, name: block.name, input: block.input };
  }
  return { type: "text", text: block.text };
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentBlock {
  if (block.type === "tool_use") {
    return { type: "tool_use", id: block.id, name: block.name, input: block.input as Record<string, unknown> };
  }
  return { type: "text", text: (block as Anthropic.TextBlock).text };
}
```

## OpenAIProvider

```typescript
// packages/agent/src/providers/openai.ts
import OpenAI from "openai";
import type { CompletionProvider, ChatParams, ChatResponse, ChatMessage, ContentBlock, ToolDefinition } from "./types.js";

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
        { role: "system", content: params.system },
        ...params.messages.map(toOpenAIMessage),
      ],
      tools: params.tools.map(toOpenAITool),
      tool_choice: "auto",
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
      stopReason: choice.finish_reason === "tool_calls" ? "tool_use"
        : choice.finish_reason === "length" ? "max_tokens"
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
      parameters: tool.inputSchema,
    },
  };
}

function toOpenAIMessage(msg: ChatMessage): OpenAI.ChatCompletionMessageParam {
  if (msg.role === "tool_result") {
    return { role: "tool", tool_call_id: msg.toolUseId, content: msg.content };
  }
  if (msg.role === "assistant") {
    const toolCalls = msg.content
      .filter((b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        type: "function" as const,
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      }));
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return {
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
  return { role: "user", content: msg.content as string };
}
```

## OllamaProvider

```typescript
// packages/agent/src/providers/ollama.ts
import { OpenAIProvider } from "./openai.js";

export class OllamaProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: "ollama",
      baseURL: process.env.OLLAMA_URL || "http://localhost:11434/v1",
    });
  }
}
```

Three lines. Ollama's API is OpenAI-compatible.

## MockProvider

```typescript
// packages/agent/src/providers/mock.ts
import type { CompletionProvider, ChatParams, ChatResponse } from "./types.js";

export class MockProvider implements CompletionProvider {
  private responses: ChatResponse[];
  public calls: ChatParams[] = [];

  constructor(responses: ChatResponse[] = []) {
    this.responses = [...responses];
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.calls.push(params);
    return this.responses.shift() ?? {
      content: [{ type: "text", text: "mock response" }],
      stopReason: "end_turn",
      usage: { input: 0, output: 0 },
    };
  }
}
```

Records every call for test assertions. Returns canned responses in order.

## Factory

```typescript
// packages/agent/src/providers/index.ts
import type { CompletionProvider } from "./types.js";

export type { CompletionProvider, ChatParams, ChatResponse, ChatMessage, ContentBlock, ToolDefinition } from "./types.js";

export function createProvider(override?: string): CompletionProvider {
  const provider = override || process.env.LEXIUS_MODEL_PROVIDER || "anthropic";

  switch (provider) {
    case "anthropic": {
      const { AnthropicProvider } = require("./anthropic.js");
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    }
    case "openai": {
      const { OpenAIProvider } = require("./openai.js");
      return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    }
    case "ollama": {
      const { OllamaProvider } = require("./ollama.js");
      return new OllamaProvider();
    }
    case "mock": {
      const { MockProvider } = require("./mock.js");
      return new MockProvider();
    }
    default:
      throw new Error(
        `Unknown model provider: ${provider}. Valid: anthropic, openai, ollama, mock`,
      );
  }
}

export function getDefaultModel(provider?: string): string {
  switch (provider || process.env.LEXIUS_MODEL_PROVIDER || "anthropic") {
    case "anthropic": return process.env.LEXIUS_MODEL || "claude-sonnet-4-6";
    case "openai":    return process.env.LEXIUS_MODEL || "gpt-4o";
    case "ollama":    return process.env.LEXIUS_MODEL || "llama3";
    case "mock":      return "mock";
    default:          return "claude-sonnet-4-6";
  }
}
```

Dynamic require so unused providers don't error when their SDK isn't installed.

## Agent Refactor

The current `agent.ts` changes:

**Before:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

export function createAgent(container, config?) {
  const client = new Anthropic();
  const tools = buildTools(config);

  async function chat(messages) {
    const response = await client.messages.create({
      model, max_tokens: 4096, temperature: 0,
      system: SYSTEM_PROMPT, tools, messages,
    });
    // ... handle tool_use blocks (Anthropic-specific types)
  }
}
```

**After:**
```typescript
import { createProvider, getDefaultModel, type CompletionProvider, type ChatMessage } from "./providers/index.js";

export function createAgent(container, config?, provider?: CompletionProvider) {
  const llm = provider ?? createProvider();
  const model = getDefaultModel();
  const tools = buildTools(config); // already normalised format

  async function chat(messages: ChatMessage[]) {
    const response = await llm.chat({
      model, maxTokens: 4096, temperature: 0,
      system: SYSTEM_PROMPT, tools, messages,
    });
    // ... handle tool_use blocks (normalised types — same logic, different types)
  }
}
```

The recursive tool-use loop stays identical. Only the types change from `Anthropic.ContentBlock` to `ContentBlock`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LEXIUS_MODEL_PROVIDER` | `anthropic` | Provider: `anthropic`, `openai`, `ollama`, `mock` |
| `LEXIUS_MODEL` | per-provider | Model override |
| `ANTHROPIC_API_KEY` | -- | Required for `anthropic` provider |
| `OPENAI_API_KEY` | -- | Required for `openai` provider |
| `OLLAMA_URL` | `http://localhost:11434/v1` | Ollama API URL |

## Testing Strategy

### Unit
- Each provider: construct with mock HTTP, verify tool schema translation, message translation, response parsing.
- `MockProvider`: verify call recording and response sequencing.
- Factory: verify correct provider instantiation for each env var value.

### Integration
- Same query against Anthropic + OpenAI: both produce tool_use blocks for `list_legislations`, both parse the tool result, both produce a text response.
- Ollama: start Ollama with llama3, run a simple query, verify tool calls execute.

### Regression
- Run the full existing test suite with `LEXIUS_MODEL_PROVIDER=mock`. All tests pass (agent tests use MockProvider, non-agent tests unaffected).

## Specflow Contract (lands with implementation)

```yaml
contract_meta:
  id: model_harness
  version: 1
  created_from_spec: "PRD-011 / ARD-015 / DDD-014 — model harness provider abstraction"
  covers_reqs:
    - HARNESS-001
    - HARNESS-002
  owner: "legal-ai-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: model_harness"

rules:
  non_negotiable:
    - id: HARNESS-001
      title: "Agent must not import provider SDKs directly"
      scope:
        - "packages/agent/src/agent.{ts,js}"
        - "packages/agent/src/conversation.{ts,js}"
        - "packages/agent/src/reasoning-loop.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /from\s+['"](?:@anthropic-ai\/sdk|openai)['"]/
            message: "Agent code must use the CompletionProvider interface, not import SDKs directly. SDK imports belong in packages/agent/src/providers/*.ts only."

    - id: HARNESS-002
      title: "Provider implementations must not import from domain or infrastructure"
      scope:
        - "packages/agent/src/providers/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /from\s+['"]@lexius\/core/
            message: "Providers are pure LLM wrappers — they must not depend on domain logic"
          - pattern: /from\s+['"]@lexius\/db/
            message: "Providers must not access the database"
```

## Rollout Order

1. Types (`packages/agent/src/providers/types.ts`)
2. `AnthropicProvider` — extract from current `agent.ts`
3. Refactor `agent.ts` to use `CompletionProvider`
4. Verify: zero regression with `LEXIUS_MODEL_PROVIDER=anthropic`
5. `MockProvider` + update agent tests
6. `OpenAIProvider`
7. `OllamaProvider`
8. Factory + env var selection
9. Update all npm packages

## Open Questions

- Whether to add `prepareTools()` as a separate method or handle conversion inside `chat()`. Inside `chat()` is simpler but converts on every call.
- Whether OpenAI's parallel tool calls need special handling (Anthropic can also return multiple tool_use blocks in one response — both are handled by the existing loop).
- Whether to bundle the `openai` npm package into the agent bundle or make it a peer dependency. Bundling increases size; peer dep requires users to install it.
