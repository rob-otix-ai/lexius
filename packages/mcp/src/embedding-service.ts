import OpenAI from "openai";
import type { EmbeddingService } from "@legal-ai/core";

export class OpenAIEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;
  private readonly model = "text-embedding-3-large";
  private readonly dimensions = 3072;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    this.client = new OpenAI({ apiKey: resolvedKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}
