ARG BASE_IMAGE=local/tracking-so-backend:circle-coach-20260929
FROM ${BASE_IMAGE}
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY packages/prisma/types/index.ts /app/packages/prisma/types/index.ts
LABEL tracking.feature="streak-calendar-20260930"
