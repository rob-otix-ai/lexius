import { createDb } from "../index.js";
import OpenAI from "openai";

export type EmbeddingFn = (texts: string[]) => Promise<number[][]>;

const BATCH_SIZE = 100;

function createEmbeddingFn(openai: OpenAI): EmbeddingFn {
  return async (texts: string[]): Promise<number[][]> => {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      console.log(
        `  Generating embeddings batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} items)...`,
      );

      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: batch,
        dimensions: 3072,
      });

      const embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);

      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  };
}

async function main() {
  const args = process.argv.slice(2);
  let legislation = "eu-ai-act";

  const flagIndex = args.indexOf("--legislation");
  if (flagIndex !== -1 && args[flagIndex + 1]) {
    legislation = args[flagIndex + 1];
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("OPENAI_API_KEY environment variable is required.");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const embed = createEmbeddingFn(openai);
  const { db, pool } = createDb(connectionString);

  console.log(`Seeding legislation: ${legislation}`);

  try {
    const seedModule = await import(`./${legislation}/index.js`);
    await seedModule.seed(db, embed);
    console.log("Seed complete.");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND"
    ) {
      console.error(`No seed module found for legislation: ${legislation}`);
      process.exit(1);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
