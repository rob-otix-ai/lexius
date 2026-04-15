import pino from "pino";

export const logger = pino({
  name: "legal-ai-cli",
  level: process.env.LOG_LEVEL || "warn",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
