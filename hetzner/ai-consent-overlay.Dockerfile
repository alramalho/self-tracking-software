FROM local/tracking-so-backend:app-store-safety-20260925
COPY apps/backend-node/package.json /app/apps/backend-node/package.json
COPY apps/backend-node/src/instrumentation.ts /app/apps/backend-node/src/instrumentation.ts
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/ai.ts /app/apps/backend-node/src/routes/ai.ts
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/followThrough.ts /app/apps/backend-node/src/routes/followThrough.ts
COPY apps/backend-node/src/routes/mcp.ts /app/apps/backend-node/src/routes/mcp.ts
COPY apps/backend-node/src/routes/onboarding.ts /app/apps/backend-node/src/routes/onboarding.ts
COPY apps/backend-node/src/routes/plans.ts /app/apps/backend-node/src/routes/plans.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/routes/voiceLogs.ts /app/apps/backend-node/src/routes/voiceLogs.ts
COPY apps/backend-node/src/services/activityCategorizationService.ts /app/apps/backend-node/src/services/activityCategorizationService.ts
COPY apps/backend-node/src/services/coach/agent.ts /app/apps/backend-node/src/services/coach/agent.ts
COPY apps/backend-node/src/services/coach/assessment/service.ts /app/apps/backend-node/src/services/coach/assessment/service.ts
COPY apps/backend-node/src/services/coach/monitoring/service.ts /app/apps/backend-node/src/services/coach/monitoring/service.ts
COPY apps/backend-node/src/services/embeddingService.ts /app/apps/backend-node/src/services/embeddingService.ts
COPY apps/backend-node/src/services/follow-through/onboarding/interview/guidance.ts /app/apps/backend-node/src/services/follow-through/onboarding/interview/guidance.ts
COPY apps/backend-node/src/services/planCategorizationService.ts /app/apps/backend-node/src/services/planCategorizationService.ts
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY apps/backend-node/src/services/sttService.ts /app/apps/backend-node/src/services/sttService.ts
COPY apps/backend-node/src/utils/aiConsent.ts /app/apps/backend-node/src/utils/aiConsent.ts
COPY apps/backend-node/src/utils/aiSdk.ts /app/apps/backend-node/src/utils/aiSdk.ts
COPY apps/backend-node/src/utils/userSelfUpdate.ts /app/apps/backend-node/src/utils/userSelfUpdate.ts
COPY packages/prisma/migrations/20260925180000_user_ai_consent/migration.sql /app/packages/prisma/migrations/20260925180000_user_ai_consent/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="ai-consent-20260925"
