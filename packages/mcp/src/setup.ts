import { logger } from "./logger.js";
import { createProxyContainer } from "./proxy-container.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

interface SetupResult {
  container: Container;
  cleanup: () => Promise<void>;
}

/**
 * Set up the MCP server container.
 *
 * Mode detection:
 *  - DATABASE_URL set            → direct mode (imports @lexius/infra, connects to Postgres)
 *  - LEXIUS_API_URL + LEXIUS_API_KEY → proxy mode (HTTP calls to the hosted API)
 *  - Both set                    → direct takes precedence
 *  - Neither set                 → throws with instructions
 */
export async function setup(): Promise<SetupResult> {
  if (process.env.DATABASE_URL) {
    logger.info("Direct mode: connecting to Postgres");
    // Dynamic import so proxy-only installs don't need @lexius/infra
    const { setup: infraSetup } = await import("@lexius/infra");
    const { container, pool } = infraSetup();
    logger.info("Service container created (direct mode)");
    return {
      container,
      cleanup: () => pool.end(),
    };
  }

  if (process.env.LEXIUS_API_URL && process.env.LEXIUS_API_KEY) {
    logger.info("Proxy mode: delegating to %s", process.env.LEXIUS_API_URL);
    const container = createProxyContainer(
      process.env.LEXIUS_API_URL,
      process.env.LEXIUS_API_KEY,
    );
    logger.info("Proxy container created");
    // The proxy container is duck-type compatible with Container at runtime;
    // cast is safe because MCP tools only call `.execute()` on each use case.
    return { container: container as unknown as Container, cleanup: async () => {} };
  }

  throw new Error(
    "Missing configuration. Set one of:\n" +
      "  - DATABASE_URL              → direct mode (Postgres)\n" +
      "  - LEXIUS_API_URL + LEXIUS_API_KEY → proxy mode (hosted API)\n",
  );
}
