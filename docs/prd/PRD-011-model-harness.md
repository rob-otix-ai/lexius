# PRD-011: Model Harness — Provider-Agnostic LLM Abstraction

## Status: Draft
## Date: 2026-04-19
## Author: Robert

---

## Problem Statement

The Lexius agent is hardcoded to the Anthropic SDK. Every LLM call goes through `@anthropic-ai/sdk` with Anthropic-specific tool schemas, response parsing, and error handling. This creates three problems:

1. **Cost inefficiency.** Simple queries (list legislations, get article by number) route through the same model as complex multi-regulation assessments. A "what legislations are available?" query costs the same as a 28-tool-call compliance analysis. No way to route cheap queries to cheaper models.

2. **Vendor lock-in.** Switching to OpenAI, Google, or a local model requires rewriting the agent, the tool definitions, and the response parser. The entire `agent.ts` file is Anthropic-specific.

3. **Development friction.** Running the agent locally requires an Anthropic API key. Developers testing seed changes, UI work, or non-LLM features still hit the API. No offline mode exists.

## Vision

A single `CompletionProvider` interface sits between the agent and the LLM. The agent calls `provider.chat(params)` and gets back a normalised response. Three provider implementations ship at launch: Anthropic (existing), OpenAI (new), and Ollama (local/offline). A fourth "mock" provider enables deterministic testing.

Switching providers is an environment variable: `LEXIUS_MODEL_PROVIDER=openai`. Switching models within a provider is another: `LEXIUS_MODEL=gpt-4o`. The agent code doesn't change.

Cost-based routing is an optional layer on top: a router examines the user's query and dispatches to a cheap model for simple lookups, an expensive model for complex reasoning. Configurable, off by default.

## Users

| Persona | Need |
|---------|------|
| **Platform Operator** | Control LLM costs by routing simple queries to cheaper models |
| **Developer** | Run the agent offline against Ollama during development |
| **Enterprise Customer** | Use their own Azure OpenAI deployment or AWS Bedrock instead of direct Anthropic |
| **Compliance Officer** | Doesn't care which model runs underneath, as long as the provenance labels are accurate |

## Product Requirements

### P0 — Must Have

1. **`CompletionProvider` interface** — a single async method:
   ```typescript
   interface CompletionProvider {
     chat(params: ChatParams): Promise<ChatResponse>;
   }
   ```
   Where `ChatParams` contains: `model`, `system`, `tools` (provider-agnostic format), `messages` (normalised), `temperature`, `maxTokens`. And `ChatResponse` contains: `content` (array of `TextBlock | ToolUseBlock`), `stopReason` (`end_turn | tool_use | max_tokens`), `usage` (input/output token counts).

2. **Normalised tool schema** — a provider-agnostic tool definition format that maps to both Anthropic and OpenAI formats:
   ```typescript
   interface ToolDefinition {
     name: string;
     description: string;
     inputSchema: JSONSchema;
   }
   ```
   Each provider translates this to its native format internally. Anthropic uses `input_schema`; OpenAI uses `function.parameters`. The agent never sees provider-specific shapes.

3. **Normalised message format** — a common message type that covers both providers:
   ```typescript
   type Message =
     | { role: "user"; content: string | ContentBlock[] }
     | { role: "assistant"; content: ContentBlock[] }
     | { role: "tool_result"; toolUseId: string; content: string };
   ```
   Each provider maps to its native format (Anthropic uses `tool_result` blocks inside user messages; OpenAI uses `tool` role messages).

4. **`AnthropicProvider`** — wraps the existing `@anthropic-ai/sdk` calls. Translates normalised types to/from Anthropic format. Drop-in replacement for the current hardcoded calls.

5. **`OpenAIProvider`** — wraps `openai` SDK. Translates tool definitions to OpenAI function-calling format. Handles the different response structure (`choices[0].message.tool_calls` vs Anthropic's `content` blocks). Supports GPT-4o, GPT-4o-mini, o1, o3.

6. **`OllamaProvider`** — wraps Ollama's OpenAI-compatible API (`http://localhost:11434/v1/chat/completions`). Uses the same translation as `OpenAIProvider` but with Ollama-specific defaults (no API key, local URL). Supports any model available in Ollama (llama3, mistral, qwen, etc.).

7. **`OpenRouterProvider`** — wraps OpenRouter's OpenAI-compatible API (`https://openrouter.ai/api/v1`). Uses the same translation as `OpenAIProvider` but with OpenRouter-specific defaults. Provides access to hundreds of models (Claude, GPT-4, Llama, Mistral, Gemini, etc.) through a single API key and unified billing. The key advantage: users can switch between any model from any provider without managing multiple API keys. Supports model routing via the standard model parameter (e.g., `anthropic/claude-sonnet-4`, `openai/gpt-4o`, `meta-llama/llama-3-70b`).

8. **`MockProvider`** — returns canned responses for testing. Configurable: can return a fixed text response, a fixed tool_use response, or echo the input. Used in unit tests so they don't hit any API.

9. **Provider selection via environment** — `LEXIUS_MODEL_PROVIDER` env var or `--provider` CLI flag selects the provider:
   - `anthropic` (default) — uses `ANTHROPIC_API_KEY`
   - `openai` — uses `OPENAI_API_KEY` (the same one used for embeddings)
   - `openrouter` — uses `OPENROUTER_API_KEY`. Access any model via a single key.
   - `ollama` — uses `OLLAMA_URL` (default `http://localhost:11434`)
   - `mock` — no API key needed

9. **Model selection via environment** — `LEXIUS_MODEL` overrides the default model for the selected provider. Defaults: `claude-sonnet-4-6` (Anthropic), `gpt-4o` (OpenAI), `llama3` (Ollama).

10. **Agent refactor** — `packages/agent/src/agent.ts` refactored to use `CompletionProvider` instead of direct Anthropic SDK calls. The `createAgent` function accepts a provider instance. No Anthropic-specific types leak outside the provider.

11. **Existing behaviour preserved** — with `LEXIUS_MODEL_PROVIDER=anthropic` (or unset), the agent behaves identically to today. Zero regression.

### P1 — Should Have

12. **Cost-based routing** — a `RoutingProvider` that wraps two providers (cheap + expensive). A classifier examines the query:
    - Simple lookups (list legislations, get article, get deadlines) → cheap model
    - Complex analysis (classify system, multi-regulation assessment, swarm synthesis) → expensive model
    The classifier is a keyword/pattern match, not an LLM call.

13. **Streaming support** — `provider.chatStream(params)` returns an async iterator of content blocks. Enables real-time response rendering in the agent CLI. Provider-specific: Anthropic uses SSE events, OpenAI uses SSE chunks.

14. **Usage tracking** — every `ChatResponse` includes token counts. The agent logs cumulative usage per session. Surfaces in the audit report metadata.

15. **Retry with fallback** — if the primary provider fails (rate limit, timeout, outage), fall back to a secondary provider. Configurable: `LEXIUS_FALLBACK_PROVIDER=openai`.

### P2 — Nice to Have

16. **AWS Bedrock provider** — wraps the Bedrock runtime SDK. Supports Claude on Bedrock and Titan models. Uses `AWS_REGION` + IAM credentials.
17. **Google Vertex AI provider** — wraps the Vertex AI SDK for Gemini models.
18. **Provider performance dashboard** — log latency, token usage, and cost per provider per query. Expose via `GET /health` or a dedicated endpoint.

## Out of Scope

- Changing the tool execution layer. `handleToolCall` stays the same regardless of provider.
- Changing the provenance system. Provider choice doesn't affect whether a fact is AUTHORITATIVE or CURATED.
- Multi-model within a single query (e.g., use GPT-4o for classification, Claude for synthesis). That's a routing concern, not a harness concern.
- Fine-tuning or training custom models.
- Embedding provider abstraction (embeddings stay on OpenAI for now; separate concern).

## Success Metrics

- Agent produces identical output for the same query across Anthropic and OpenAI providers (deterministic tool calls, same findings, same provenance labels).
- Running `LEXIUS_MODEL_PROVIDER=ollama npx @robotixai/lexius-agent` starts a working agent session against a local model with no API keys.
- Switching from `claude-sonnet-4-6` to `gpt-4o-mini` for simple queries reduces per-query cost by 80%+ with no change in factual accuracy (all facts come from the DB, not the model).
- Existing tests pass without modification when provider is set to `mock`.
- Zero Anthropic-specific types in `packages/agent/src/agent.ts` after refactor.

## Rollout

1. Define `CompletionProvider` interface + normalised types in `packages/agent/src/providers/types.ts`.
2. Implement `AnthropicProvider` — extract from existing `agent.ts`.
3. Refactor `agent.ts` to use provider interface.
4. Verify: existing behaviour unchanged with `LEXIUS_MODEL_PROVIDER=anthropic`.
5. Implement `OpenAIProvider`.
6. Implement `OllamaProvider`.
7. Implement `MockProvider` + update tests.
8. Env-var-based provider selection in `setup.ts`.
9. Update npm packages + republish.
