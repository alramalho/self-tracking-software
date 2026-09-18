ARG BASE_IMAGE=local/tracking-so-backend:people-activity-20260916
FROM ${BASE_IMAGE}

# Apple Health vitals visibility and explicit per-workout sharing. The share
# choice lives in the existing reconciliation JSON, so this layer needs no
# schema migration or generated-client replacement.
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/types.ts /app/apps/backend-node/src/services/health/apple/reconciliation/types.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/schemas.ts /app/apps/backend-node/src/services/health/apple/reconciliation/schemas.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/service.ts /app/apps/backend-node/src/services/health/apple/reconciliation/service.ts
