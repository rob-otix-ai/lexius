// Resolve the current credential role for MCP tools/list filtering.
// Reads env first (LEXIUS_ROLE override), then falls back to the
// credentials file via @robotixai/lexius-credentials. Any error resolves
// to "reader" so an unconfigured MCP server cannot surface curator tools
// to the model.

import { logger } from "./logger.js";

export type Role = "reader" | "curator";

export function resolveCurrentRole(): Role {
  const envRole = process.env.LEXIUS_ROLE;
  if (envRole === "curator" || envRole === "reader") return envRole;

  try {
    // Dynamic require so proxy-only installs that don't ship the credentials
    // package still boot. Failing to load defaults to reader.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@robotixai/lexius-credentials");
    const creds = mod.loadCredentials?.();
    if (creds?.role === "curator") return "curator";
    return "reader";
  } catch (err) {
    logger.debug(
      { err: (err as Error).message },
      "credentials package unavailable; defaulting role=reader",
    );
    return "reader";
  }
}
