ARG BASE_IMAGE=local/tracking-so-backend:stt-openrouter-20260915
FROM ${BASE_IMAGE}

# Preserve the active production image and overlay only the Apple Health effort
# ingestion, storage, and workout-reconciliation files used by build 33.
COPY apps/backend-node/src/services/health/apple/types.ts /app/apps/backend-node/src/services/health/apple/types.ts
COPY apps/backend-node/src/services/health/apple/schemas.ts /app/apps/backend-node/src/services/health/apple/schemas.ts
COPY apps/backend-node/src/services/health/apple/syncService.ts /app/apps/backend-node/src/services/health/apple/syncService.ts
COPY apps/backend-node/src/services/health/apple/effort.ts /app/apps/backend-node/src/services/health/apple/effort.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/types.ts /app/apps/backend-node/src/services/health/apple/reconciliation/types.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/service.ts /app/apps/backend-node/src/services/health/apple/reconciliation/service.ts
