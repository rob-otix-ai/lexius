import OpenAI from "openai";
import type { EmbeddingService } from "@legal-ai/core";

export class OpenAIEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;
  private readonly model = "text-embedding-3-large";
  private readonly dimensions = 3072;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey });
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
