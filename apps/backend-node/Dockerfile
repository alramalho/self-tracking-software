FROM node:22-alpine AS builder

# Install pnpm and OpenSSL for Prisma
RUN npm install -g pnpm
RUN apk add --no-cache openssl

WORKDIR /app
ENV CI=true
ENV TURBO_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ENV DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Install only the backend workspace and its dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/backend-node/package.json apps/backend-node/package.json
COPY packages/prisma/package.json packages/prisma/package.json

RUN pnpm install --frozen-lockfile --filter backend-node...

# Copy only the files needed by the backend image.
COPY apps/backend-node apps/backend-node
COPY packages/prisma packages/prisma

# Refresh Prisma client for the checked-in schema; typed SQL files are kept in the Docker context.
RUN pnpm --filter @tsw/prisma db:generate
RUN pnpm --filter backend-node build

# Production stage
FROM node:22-alpine AS production

# Install pnpm and OpenSSL for Prisma
RUN npm install -g pnpm
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend-node ./apps/backend-node
COPY --from=builder /app/packages/prisma ./packages/prisma

# Set working directory to backend-node
WORKDIR /app/apps/backend-node

# Expose port 8000
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
