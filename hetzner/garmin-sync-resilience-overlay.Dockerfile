ARG BASE_IMAGE=local/tracking-so-backend:goal-guidance-20260918
FROM ${BASE_IMAGE}

# Keep the active production image intact while allowing Garmin's optional
# backfill step to fail without aborting the normal sync pull.
COPY service.ts /app/apps/backend-node/src/services/health/garmin/service.ts
