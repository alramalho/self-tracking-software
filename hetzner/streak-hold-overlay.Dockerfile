FROM local/tracking-so-backend:apple-iap-20260927
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY packages/prisma/types/index.ts /app/packages/prisma/types/index.ts
LABEL tracking.feature="streak-hold-20260928"
