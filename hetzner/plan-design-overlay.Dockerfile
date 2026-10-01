ARG BASE_IMAGE=local/tracking-so-backend:circle-encouragement-20260930
FROM ${BASE_IMAGE}
COPY apps/backend-node/src/routes/ai.ts /app/apps/backend-node/src/routes/ai.ts
COPY apps/backend-node/src/routes/followThrough.ts /app/apps/backend-node/src/routes/followThrough.ts
COPY apps/backend-node/src/services/aiModelIds.ts /app/apps/backend-node/src/services/aiModelIds.ts
COPY apps/backend-node/src/services/coach/agent.ts /app/apps/backend-node/src/services/coach/agent.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/context.ts /app/apps/backend-node/src/services/coach/monitoring/generation/context.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/proposals.ts /app/apps/backend-node/src/services/coach/monitoring/generation/proposals.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/schema.ts /app/apps/backend-node/src/services/coach/monitoring/generation/schema.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/service.ts /app/apps/backend-node/src/services/coach/monitoring/generation/service.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/window.ts /app/apps/backend-node/src/services/coach/monitoring/generation/window.ts
COPY apps/backend-node/src/services/coach/types.ts /app/apps/backend-node/src/services/coach/types.ts
COPY apps/backend-node/src/services/follow-through/onboarding/schema.ts /app/apps/backend-node/src/services/follow-through/onboarding/schema.ts
COPY apps/backend-node/src/services/follow-through/onboarding/service.ts /app/apps/backend-node/src/services/follow-through/onboarding/service.ts
COPY apps/backend-node/src/services/plan-design/apply.ts /app/apps/backend-node/src/services/plan-design/apply.ts
COPY apps/backend-node/src/services/plan-design/baseline.ts /app/apps/backend-node/src/services/plan-design/baseline.ts
COPY apps/backend-node/src/services/plan-design/dates.ts /app/apps/backend-node/src/services/plan-design/dates.ts
COPY apps/backend-node/src/services/plan-design/draft.ts /app/apps/backend-node/src/services/plan-design/draft.ts
COPY apps/backend-node/src/services/plan-design/frequency.ts /app/apps/backend-node/src/services/plan-design/frequency.ts
COPY apps/backend-node/src/services/plan-design/generator.ts /app/apps/backend-node/src/services/plan-design/generator.ts
COPY apps/backend-node/src/services/plan-design/prompts.ts /app/apps/backend-node/src/services/plan-design/prompts.ts
COPY apps/backend-node/src/services/plan-design/requests.ts /app/apps/backend-node/src/services/plan-design/requests.ts
COPY apps/backend-node/src/services/plan-design/schema.ts /app/apps/backend-node/src/services/plan-design/schema.ts
COPY apps/backend-node/src/services/plan-design/service.ts /app/apps/backend-node/src/services/plan-design/service.ts
COPY apps/backend-node/src/services/plan-design/types.ts /app/apps/backend-node/src/services/plan-design/types.ts
COPY apps/backend-node/src/services/plan-design/validate.ts /app/apps/backend-node/src/services/plan-design/validate.ts
COPY apps/backend-node/src/services/planProposalPatchService.ts /app/apps/backend-node/src/services/planProposalPatchService.ts
COPY packages/prisma/follow-through/design.ts /app/packages/prisma/follow-through/design.ts
COPY packages/prisma/follow-through/types.ts /app/packages/prisma/follow-through/types.ts
COPY packages/prisma/migrations/20261001090000_plan_design/migration.sql /app/packages/prisma/migrations/20261001090000_plan_design/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
# The schema gained plan design columns, so the Prisma client is regenerated.
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="plan-design-20261001"
