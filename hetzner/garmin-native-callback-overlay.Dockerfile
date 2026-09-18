ARG BASE_IMAGE=local/tracking-so-backend:garmin-sync-20260917
FROM ${BASE_IMAGE}

# Keep the existing Garmin integration and change only the OAuth return target
# plumbing needed by native authenticated browser sessions.
COPY apps/backend-node/src/routes/garmin.ts /app/apps/backend-node/src/routes/garmin.ts
COPY apps/backend-node/src/services/health/garmin/service.ts /app/apps/backend-node/src/services/health/garmin/service.ts
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
COPY packages/prisma/migrations/20260918070000_add_garmin_oauth_return_url /app/packages/prisma/migrations/20260918070000_add_garmin_oauth_return_url

RUN pnpm --dir /app/packages/prisma exec prisma generate
