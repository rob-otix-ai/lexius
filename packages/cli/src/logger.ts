import { createLogger, type Logger } from "@lexius/logger";

export const logger: Logger = createLogger({ name: "legal-ai-cli", level: "warn" });
