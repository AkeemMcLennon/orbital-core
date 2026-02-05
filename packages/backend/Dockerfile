# Stage 1: Build - Install all dependencies
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock ./

# Copy all packages
COPY packages ./packages

# Install dependencies (ignoring optional dependency failures)
RUN bun install || true

# Stage 2: Runtime
FROM oven/bun:1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock ./

# Copy only required packages for backend runtime
COPY packages/backend ./packages/backend
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/testing ./packages/testing
COPY packages/client ./packages/client

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Set working directory to backend
WORKDIR /app/packages/backend

# Copy startup script
COPY packages/backend/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create data directory for SQLite database
RUN mkdir -p /app/packages/backend/data

# Set default environment variables
# These can be overridden by docker-compose.yml env_file or -e flags
ENV DB_PROVIDER=sqlite
ENV SQLITE_DB_PATH=/app/packages/backend/data/local.db
ENV NODE_ENV=production

# Expose port
EXPOSE 8787

# Run startup script
CMD ["./start.sh"]
