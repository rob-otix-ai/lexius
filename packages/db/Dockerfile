FROM pgvector/pgvector:pg16

# Extensions (pgvector)
COPY docker-entrypoint-initdb.d/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql

# Migrations (applied in order by 02-migrations.sh)
COPY src/migrations/*.sql /docker-entrypoint-initdb.d/migrations/

# Migration runner
COPY docker-entrypoint-initdb.d/02-migrations.sh /docker-entrypoint-initdb.d/02-migrations.sh

ENV POSTGRES_DB=legal_ai
ENV POSTGRES_USER=legal_ai

LABEL org.opencontainers.image.title="Lexius DB"
LABEL org.opencontainers.image.description="PostgreSQL 16 + pgvector with Lexius compliance schema (EU AI Act, DORA)"
LABEL org.opencontainers.image.source="https://github.com/rob-otix-ai/lexius"
LABEL org.opencontainers.image.vendor="RobotixAI"
