ARG BASE_IMAGE=local/tracking-so-backend:onboarding-jev-only-20260918
FROM ${BASE_IMAGE}

# Keep the active production image intact while fixing Garmin historical
# backfill range/permission reporting and the sync result shown to the app.
COPY apps/backend-node/src/routes/garmin.ts /app/apps/backend-node/src/routes/garmin.ts
COPY apps/backend-node/src/services/health/garmin/service.ts /app/apps/backend-node/src/services/health/garmin/service.ts
COPY apps/backend-node/src/services/health/garmin/types.ts /app/apps/backend-node/src/services/health/garmin/types.ts
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
COPY packages/prisma/migrations/20260918150000_add_garmin_backfill_queue /app/packages/prisma/migrations/20260918150000_add_garmin_backfill_queue

RUN pnpm --dir /app/packages/prisma exec prisma generate
