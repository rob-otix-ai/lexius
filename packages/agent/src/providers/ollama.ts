import { OpenAIProvider } from "./openai.js";

export class OllamaProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: "ollama",
      baseURL: process.env.OLLAMA_URL || "http://localhost:11434/v1",
    });
  }
}
