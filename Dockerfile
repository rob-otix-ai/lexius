# Multi-stage Dockerfile for the Lexius API (monorepo root build)
# Build: docker build -t lexius-api .
# Run:   docker run -p 3000:3000 -e DATABASE_URL=... lexius-api

FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY scripts/ scripts/
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "packages/api/dist/index.js"]
