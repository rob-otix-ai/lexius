#!/usr/bin/env tsx
/**
 * CLI script to create a new API key for the Lexius API.
 *
 * Usage:
 *   pnpm create-api-key -- --email user@company.com --name "Production Key"
 *
 * Requires DATABASE_URL in the environment. Prints the full key to stdout
 * exactly once -- it is never stored in cleartext.
 */

import { randomBytes, createHash } from "node:crypto";
import { createDb, apiKeys } from "@lexius/db";

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `lx_${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

function parseArgs(argv: string[]): { email: string; name: string } {
  let email = "";
  let name = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) {
      email = argv[++i];
    } else if (argv[i] === "--name" && argv[i + 1]) {
      name = argv[++i];
    }
  }
  if (!email || !name) {
    console.error("Usage: create-api-key --email <email> --name <name>");
    process.exit(1);
  }
  return { email, name };
}

async function main() {
  const { email, name } = parseArgs(process.argv.slice(2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const { db, pool } = createDb(connectionString);
  const { key, hash, prefix } = generateApiKey();

  await db.insert(apiKeys).values({
    keyHash: hash,
    keyPrefix: prefix,
    ownerEmail: email,
    name,
  });

  console.log(key);

  await pool.end();
}

main().catch((err) => {
  console.error("Failed to create API key:", err);
  process.exit(1);
});
