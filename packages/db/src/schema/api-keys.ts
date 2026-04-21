import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  role: text("role").notNull().default("reader"),
  rateLimit: integer("rate_limit").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});

export type ApiKeyRole = "reader" | "curator";
