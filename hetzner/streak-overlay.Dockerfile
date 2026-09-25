FROM local/tracking-so-backend:plan-nudges-20260925
COPY apps/backend-node/src/services/aiService.ts /app/apps/backend-node/src/services/aiService.ts
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY packages/prisma/types/index.ts /app/packages/prisma/types/index.ts
LABEL tracking.feature="streak-no-grace-20260925"
