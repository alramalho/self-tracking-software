ARG BASE_IMAGE=local/tracking-so-backend:voice-log-20260917a
FROM ${BASE_IMAGE}

# The base image already contains the voice-log route registration. Overlay only
# the route and service implementation so unrelated local index changes cannot
# make the production container diverge from its known-good runtime.
COPY apps/backend-node/src/routes/voiceLogs.ts /app/apps/backend-node/src/routes/voiceLogs.ts
COPY apps/backend-node/src/services/voice-log /app/apps/backend-node/src/services/voice-log
