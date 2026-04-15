import pino from "pino";
import type { Logger } from "pino";

export type { Logger };

export interface CreateLoggerOptions {
  name: string;
  level?: string;
}

export function createLogger({ name, level }: CreateLoggerOptions): Logger {
  return pino({
    name,
    level: level || process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  });
}
