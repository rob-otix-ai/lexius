import { OpenAIProvider } from "./openai.js";

export class OpenRouterProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
}
