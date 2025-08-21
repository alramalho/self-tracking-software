FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace package files from root
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy backend-node package.json first to ensure dependencies are known
COPY backend-node/package.json ./backend-node/

# Install ALL dependencies (including dev deps for building)
RUN pnpm install --frozen-lockfile --no-cache

# Copy backend-node source code
COPY backend-node/ ./backend-node/
COPY prisma/ ./prisma/

# Build TypeScript from workspace root
RUN pnpm db:generate
RUN pnpm build --filter backend-node

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --no-cache

# Copy built application from builder stage
COPY --from=builder /app/backend-node/dist ./backend-node/dist
COPY --from=builder /app/backend-node/package.json ./backend-node/

WORKDIR /app/backend-node

# Expose port 8000
EXPOSE 8000

# Start the application
CMD ["pnpm", "start"]