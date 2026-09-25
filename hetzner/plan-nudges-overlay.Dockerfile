FROM local/tracking-so-backend:coach-garmin-20260924
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/followThrough.ts /app/apps/backend-node/src/routes/followThrough.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/proposals.ts /app/apps/backend-node/src/services/coach/monitoring/generation/proposals.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/service.ts /app/apps/backend-node/src/services/coach/monitoring/generation/service.ts
COPY apps/backend-node/src/services/coach/monitoring/model.ts /app/apps/backend-node/src/services/coach/monitoring/model.ts
COPY apps/backend-node/src/services/coach/monitoring/requests.ts /app/apps/backend-node/src/services/coach/monitoring/requests.ts
COPY apps/backend-node/src/services/coach/monitoring/service.ts /app/apps/backend-node/src/services/coach/monitoring/service.ts
COPY apps/backend-node/src/services/coach/monitoring/types.ts /app/apps/backend-node/src/services/coach/monitoring/types.ts
COPY apps/backend-node/src/services/coach/types.ts /app/apps/backend-node/src/services/coach/types.ts
COPY packages/prisma/follow-through/coaching.ts /app/packages/prisma/follow-through/coaching.ts
COPY packages/prisma/follow-through/pace.ts /app/packages/prisma/follow-through/pace.ts
COPY packages/prisma/package.json /app/packages/prisma/package.json
LABEL tracking.feature="plan-nudges-20260925"
