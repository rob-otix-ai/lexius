# ARD-015: Model Harness Architecture

## Status: Accepted
## Date: 2026-04-19

---

## Context

The agent is hardcoded to `@anthropic-ai/sdk`. PRD-011 requires a provider abstraction that supports Anthropic, OpenAI, and Ollama without changing the agent logic. The key constraint: tool-use semantics differ significantly between providers.

## Decision

### 1. Single interface, provider-internal translation

```typescript
interface CompletionProvider {
  chat(params: ChatParams): Promise<ChatResponse>;
}
```

The interface is deliberately minimal. One method. No streaming in P0 (add `chatStream` in P1). No provider-specific options leak through.

Each provider translates internally:
- **Tool definitions**: Anthropic uses `{ name, description, input_schema }`; OpenAI uses `{ type: "function", function: { name, description, parameters } }`. The normalised format uses `inputSchema` (JSON Schema), and each provider wraps it.
- **Messages**: Anthropic puts tool results in user messages as `tool_result` content blocks; OpenAI uses a separate `tool` role. The normalised format uses `{ role: "tool_result", toolUseId, content }` and each provider maps it.
- **Responses**: Anthropic returns `content: [{ type: "text" | "tool_use" }]`; OpenAI returns `choices[0].message.tool_calls[]`. The normalised response uses `content: ContentBlock[]` with discriminated types.

Rejected alternatives:
- **Adapter pattern on Anthropic types** — keeps Anthropic as the canonical format and translates others to it. Couples the abstraction to one vendor.
- **LangChain / Vercel AI SDK** — adds a large dependency for a small abstraction. Our interface is ~30 lines of types; these SDKs are 10,000+.
- **OpenAI-compatible API everywhere** — Anthropic has an OpenAI-compatible endpoint, but it doesn't support all features (extended thinking, prompt caching). Native SDKs are more reliable.

### 2. Provider lives in `packages/agent/src/providers/`

```
packages/agent/src/providers/
├── types.ts              -- ChatParams, ChatResponse, ContentBlock, ToolDefinition
├── anthropic.ts          -- AnthropicProvider
├── openai.ts             -- OpenAIProvider
├── ollama.ts             -- OllamaProvider (extends OpenAIProvider with Ollama defaults)
├── mock.ts               -- MockProvider (for tests)
├── router.ts             -- RoutingProvider (P1)
└── index.ts              -- createProvider(config) factory
```

No new package. Providers are internal to `@robotixai/lexius-agent`. The factory reads env vars and returns the right provider.

Rejected: separate `@robotixai/lexius-providers` package. Over-engineered — no other package needs the abstraction.

### 3. Tool definition normalisation happens once at agent creation

The agent's `TOOLS` array is defined in the normalised format. At `createAgent()` time, the provider converts them to its native format once. Not per-call.

```typescript
// agent.ts
const tools: ToolDefinition[] = buildTools(config); // normalised
const provider = createProvider();                    // reads env
const nativeTools = provider.prepareTools(tools);     // one-time conversion

// chat loop
const response = await provider.chat({
  model, system, tools: nativeTools, messages, temperature: 0,
});
```

`prepareTools` is an optional method on the provider. If not implemented, the chat method converts inline.

### 4. Ollama reuses OpenAI provider with different defaults

Ollama exposes an OpenAI-compatible `/v1/chat/completions` endpoint. `OllamaProvider` extends `OpenAIProvider` with:
- `baseURL: process.env.OLLAMA_URL || "http://localhost:11434/v1"`
- `apiKey: "ollama"` (required by the SDK but not validated)
- `defaultModel: "llama3"`

No separate SDK dependency. Same `openai` package, different config.

### 4a. OpenRouter reuses OpenAI provider with unified model access

OpenRouter (`openrouter.ai`) provides a single OpenAI-compatible API that routes to hundreds of models across providers (Anthropic, OpenAI, Meta, Google, Mistral, etc.). One API key, one endpoint, unified billing.

`OpenRouterProvider` extends `OpenAIProvider` with:
- `baseURL: "https://openrouter.ai/api/v1"`
- `apiKey: process.env.OPENROUTER_API_KEY`
- `defaultModel: "anthropic/claude-sonnet-4"` (or whatever the user configures via `LEXIUS_MODEL`)

Same pattern as Ollama — a thin subclass, no new SDK dependency. The `openai` package works directly against OpenRouter's endpoint.

Why this matters:
- **Single key for everything** — users don't need separate Anthropic, OpenAI, and Google keys. One OpenRouter key accesses all of them.
- **Model comparison** — run the same compliance query against `anthropic/claude-sonnet-4`, `openai/gpt-4o`, and `google/gemini-2.0-flash` to compare tool-use quality. The harness handles it transparently.
- **Cost routing** — OpenRouter supports model fallbacks and cost-optimised routing. A user can configure `auto` as the model and let OpenRouter pick the cheapest model that handles tool-use.
- **No vendor relationship needed** — useful for users who can't or won't sign up directly with each provider.

Rejected: building a custom multi-provider router. OpenRouter already solves this at the API level; wrapping it is ~5 lines of code.

### 5. Provider selection is a factory function, not dependency injection

```typescript
// providers/index.ts
export function createProvider(): CompletionProvider {
  const provider = process.env.LEXIUS_MODEL_PROVIDER || "anthropic";
  switch (provider) {
    case "anthropic": return new AnthropicProvider();
    case "openai":    return new OpenAIProvider();
    case "ollama":    return new OllamaProvider();
    case "mock":      return new MockProvider();
    default:          throw new Error(`Unknown provider: ${provider}`);
  }
}
```

The agent calls `createProvider()` once at startup. No runtime switching.

Rejected: dependency injection via constructor. Adds complexity with no benefit — the provider is selected once and never changes during a session.

### 6. Mock provider enables deterministic testing

```typescript
class MockProvider implements CompletionProvider {
  constructor(private responses: ChatResponse[]) {}

  async chat(): Promise<ChatResponse> {
    return this.responses.shift() ?? { content: [{ type: "text", text: "mock" }], stopReason: "end_turn", usage: { input: 0, output: 0 } };
  }
}
```

Tests construct a `MockProvider` with canned responses and pass it to `createAgent`. No API calls, no env vars, fully deterministic.

### 7. The agent's recursive tool-use loop stays provider-agnostic

Current loop:
1. Call LLM with messages + tools
2. If response contains `tool_use` blocks, execute them
3. Append tool results to messages
4. Call LLM again
5. Repeat until `stopReason !== "tool_use"`

This loop doesn't change. The only difference is: step 1 calls `provider.chat()` instead of `client.messages.create()`. Step 3 appends normalised `tool_result` messages.

### 8. Token usage tracked on every response

```typescript
interface ChatResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input: number; output: number };
}
```

Both Anthropic and OpenAI return token counts. Ollama may or may not (depends on the model). The agent logs cumulative usage per session.

## Consequences

### Positive

- Vendor independence without abstraction bloat (one interface, ~30 lines of types).
- Offline development via Ollama — no API key needed for non-LLM-dependent work.
- Cost control via model selection — GPT-4o-mini or Haiku for simple queries.
- Test isolation via MockProvider — agent tests run in CI without API credentials.
- No breaking change — default behaviour is identical to today.

### Negative

- Tool-use quality varies by model. Claude and GPT-4o handle multi-step tool chains well; smaller models (Haiku, GPT-4o-mini, llama3) may struggle with complex 28-tool-call assessments. The harness doesn't solve this — it just makes it possible to observe.
- Two SDK dependencies instead of one (`@anthropic-ai/sdk` + `openai`). Bundled into the agent package; no user-facing impact.
- OpenAI's function-calling format has subtle differences from Anthropic's tool-use (parallel tool calls, strict mode, etc.). The provider must handle these. Edge cases will surface in testing.

### Mitigations

- Start with Anthropic as default; only switch when confident the alternative handles the query class well.
- The provenance system is model-independent — all facts come from the DB regardless of which LLM is routing. Model quality only affects the routing + synthesis, not the factual content.
- Comprehensive tool-call tests against all three providers before shipping.
