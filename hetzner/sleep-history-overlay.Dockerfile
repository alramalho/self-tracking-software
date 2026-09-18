ARG BASE_IMAGE=local/tracking-so-backend:goal-guidance-jev-final-20260918
FROM ${BASE_IMAGE}

# Keep the active production image intact while allowing the sleep screen to
# request the full 7D/1M/6M history windows.
COPY sleep-service.ts /app/apps/backend-node/src/services/health/apple/sleep/service.ts
COPY health-route.ts /app/apps/backend-node/src/routes/health.ts
COPY garmin-route.ts /app/apps/backend-node/src/routes/garmin.ts
