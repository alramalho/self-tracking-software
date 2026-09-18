ARG BASE_IMAGE=local/tracking-so-backend:onboarding-luna-20260917
FROM ${BASE_IMAGE}

# Unified Apple Watch voice logging. This overlay keeps the active production
# image (including Parakeet STT and Luna onboarding) and adds only the route,
# extraction/commit service, schemas, and route registration required by the
# new Watch client.
COPY apps/backend-node/src/index.ts /app/apps/backend-node/src/index.ts
COPY apps/backend-node/src/routes/voiceLogs.ts /app/apps/backend-node/src/routes/voiceLogs.ts
COPY apps/backend-node/src/services/voice-log /app/apps/backend-node/src/services/voice-log
