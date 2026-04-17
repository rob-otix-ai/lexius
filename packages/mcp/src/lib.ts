/**
 * Library exports for @lexius/mcp.
 * Used by @lexius/api to mount the MCP server over SSE on the Express app.
 */
export { registerTools } from "./tools/index.js";
export { createServer } from "./server.js";
export { SERVER_NAME, SERVER_VERSION, SERVER_DISCLAIMER } from "./constants.js";
