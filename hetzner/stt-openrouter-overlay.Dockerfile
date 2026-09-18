ARG BASE_IMAGE=local/tracking-so-backend:interview-health-20260915
FROM ${BASE_IMAGE}

# Keep the currently deployed backend intact and overlay only the speech-to-text
# runtime files. This avoids shipping unrelated worktree changes with a small
# provider/model configuration change.
COPY apps/backend-node/src/services/sttService.ts /app/apps/backend-node/src/services/sttService.ts
COPY apps/backend-node/src/services/stt/config.ts /app/apps/backend-node/src/services/stt/config.ts
COPY apps/backend-node/src/services/stt/types.ts /app/apps/backend-node/src/services/stt/types.ts
