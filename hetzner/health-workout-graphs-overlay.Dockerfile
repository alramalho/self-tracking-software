ARG BASE_IMAGE=local/tracking-so-backend:garmin-sync-20260917
FROM ${BASE_IMAGE}

# Extend the live Apple Health overlay with heart-rate samples and route
# coordinates while retaining the already-deployed elevation/zone behavior.
COPY apps/backend-node/src/services/health/apple/types.ts /app/apps/backend-node/src/services/health/apple/types.ts
COPY apps/backend-node/src/services/health/apple/schemas.ts /app/apps/backend-node/src/services/health/apple/schemas.ts
COPY apps/backend-node/src/services/health/apple/syncService.ts /app/apps/backend-node/src/services/health/apple/syncService.ts
COPY apps/backend-node/src/services/health/apple/effort.ts /app/apps/backend-node/src/services/health/apple/effort.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/types.ts /app/apps/backend-node/src/services/health/apple/reconciliation/types.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/service.ts /app/apps/backend-node/src/services/health/apple/reconciliation/service.ts
