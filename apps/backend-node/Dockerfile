FROM node:22-alpine AS builder

# Install pnpm and OpenSSL for Prisma
RUN npm install -g pnpm 
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client and build
RUN pnpm db:generate
RUN pnpm db:generate:sql
RUN pnpm build --filter backend-node

# Production stage
FROM node:22-alpine AS production

# Install pnpm and OpenSSL for Prisma
RUN npm install -g pnpm 
RUN apk add --no-cache openssl

WORKDIR /app

# Copy the entire built monorepo
COPY --from=builder /app .

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Set working directory to backend-node
WORKDIR /app/apps/backend-node

# Expose port 8000
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]