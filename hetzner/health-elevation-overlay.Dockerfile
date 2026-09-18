ARG BASE_IMAGE=local/tracking-so-backend@sha256:a19d221bc3c02668a0e9c339f6950b1c296db99d7a37011f0401cdcf00ad4c2d
FROM ${BASE_IMAGE}

# Add the Apple Health workout-route profile while preserving the active
# production image and its voice-log, onboarding and privacy behavior.
COPY apps/backend-node/src/services/health/apple/types.ts /app/apps/backend-node/src/services/health/apple/types.ts
COPY apps/backend-node/src/services/health/apple/schemas.ts /app/apps/backend-node/src/services/health/apple/schemas.ts
COPY apps/backend-node/src/services/health/apple/syncService.ts /app/apps/backend-node/src/services/health/apple/syncService.ts
COPY apps/backend-node/src/services/health/apple/effort.ts /app/apps/backend-node/src/services/health/apple/effort.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/types.ts /app/apps/backend-node/src/services/health/apple/reconciliation/types.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/service.ts /app/apps/backend-node/src/services/health/apple/reconciliation/service.ts
