FROM node:20-slim

WORKDIR /app
COPY dist/bundle.cjs ./lexius-mcp.cjs

LABEL org.opencontainers.image.title="Lexius MCP"
LABEL org.opencontainers.image.description="MCP server for Lexius AI compliance platform — stdio and SSE transports"
LABEL org.opencontainers.image.source="https://github.com/rob-otix-ai/lexius"
LABEL org.opencontainers.image.vendor="RobotixAI"

ENTRYPOINT ["node", "lexius-mcp.cjs"]
