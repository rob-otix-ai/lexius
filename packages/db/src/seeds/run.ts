import { createDb } from "../index.js";
import OpenAI from "openai";
import { seed as seedEuAiAct } from "./eu-ai-act/index.js";
import { seedDora } from "./dora/index.js";

export type EmbeddingFn = (texts: string[]) => Promise<number[][]>;

const BATCH_SIZE = 100;

async function embedWithRetry(openai: OpenAI, batch: string[], retries = 3): Promise<number[][]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: batch,
        dimensions: 3072,
      });
      return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`Embedding API failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

function createEmbeddingFn(openai: OpenAI): EmbeddingFn {
  return async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      console.log(
        `  Generating embeddings batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} items)...`,
      );

      const embeddings = await embedWithRetry(openai, batch);

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
    switch (legislation) {
      case "eu-ai-act":
        await seedEuAiAct(db, embed);
        break;
      case "dora":
        await seedDora(db, embed);
        break;
      default:
        console.error(`No seed module found for legislation: ${legislation}`);
        process.exit(1);
    }
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
