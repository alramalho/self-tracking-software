ARG BASE_IMAGE=local/tracking-so-backend:plan-confidence-20261015
FROM ${BASE_IMAGE}
# The October 19 release (main adad6b93) on top of plan-confidence-20261015:
# - App Store consent: AI consent enforced by default, account deletion removes coach memory, contact and plan images,
#   and what people write stays out of logs, Better Stack and Telegram.
# - Duplicate activities: GET /activities/:id/duplicate and POST /activities/:id/merge.
# - Coach says hi first: a one-line opener, a private agenda for the reply, silence after two unanswered outreaches.
# No schema change and no migration. Every replaced file matched source 67a5bc65 in the live container (checked Oct 19).
COPY apps/backend-node/src/middleware/auth.ts /app/apps/backend-node/src/middleware/auth.ts
COPY apps/backend-node/src/middleware/errorHandler.ts /app/apps/backend-node/src/middleware/errorHandler.ts
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/admin.ts /app/apps/backend-node/src/routes/admin.ts
COPY apps/backend-node/src/routes/ai.ts /app/apps/backend-node/src/routes/ai.ts
COPY apps/backend-node/src/routes/appleBilling.ts /app/apps/backend-node/src/routes/appleBilling.ts
COPY apps/backend-node/src/routes/auth.ts /app/apps/backend-node/src/routes/auth.ts
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/clerk.ts /app/apps/backend-node/src/routes/clerk.ts
COPY apps/backend-node/src/routes/coaches.ts /app/apps/backend-node/src/routes/coaches.ts
COPY apps/backend-node/src/routes/mcp.ts /app/apps/backend-node/src/routes/mcp.ts
COPY apps/backend-node/src/routes/onboarding.ts /app/apps/backend-node/src/routes/onboarding.ts
COPY apps/backend-node/src/routes/plans.ts /app/apps/backend-node/src/routes/plans.ts
COPY apps/backend-node/src/routes/stripe.ts /app/apps/backend-node/src/routes/stripe.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/routes/utils.ts /app/apps/backend-node/src/routes/utils.ts
COPY apps/backend-node/src/services/activities/duplicates.ts /app/apps/backend-node/src/services/activities/duplicates.ts
COPY apps/backend-node/src/services/activities/merge.ts /app/apps/backend-node/src/services/activities/merge.ts
COPY apps/backend-node/src/services/activities/types.ts /app/apps/backend-node/src/services/activities/types.ts
COPY apps/backend-node/src/services/activityCategorizationService.ts /app/apps/backend-node/src/services/activityCategorizationService.ts
COPY apps/backend-node/src/services/activityReflectionReasonService.ts /app/apps/backend-node/src/services/activityReflectionReasonService.ts
COPY apps/backend-node/src/services/aiService.ts /app/apps/backend-node/src/services/aiService.ts
COPY apps/backend-node/src/services/browserAgentService.ts /app/apps/backend-node/src/services/browserAgentService.ts
COPY apps/backend-node/src/services/coach/agenda/context.ts /app/apps/backend-node/src/services/coach/agenda/context.ts
COPY apps/backend-node/src/services/coach/agenda/read.ts /app/apps/backend-node/src/services/coach/agenda/read.ts
COPY apps/backend-node/src/services/coach/agenda/types.ts /app/apps/backend-node/src/services/coach/agenda/types.ts
COPY apps/backend-node/src/services/coach/agent.ts /app/apps/backend-node/src/services/coach/agent.ts
COPY apps/backend-node/src/services/coach/assessment/prompt.ts /app/apps/backend-node/src/services/coach/assessment/prompt.ts
COPY apps/backend-node/src/services/coach/assessment/service.ts /app/apps/backend-node/src/services/coach/assessment/service.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/context.ts /app/apps/backend-node/src/services/coach/monitoring/generation/context.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/proposals.ts /app/apps/backend-node/src/services/coach/monitoring/generation/proposals.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/schema.ts /app/apps/backend-node/src/services/coach/monitoring/generation/schema.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/service.ts /app/apps/backend-node/src/services/coach/monitoring/generation/service.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/types.ts /app/apps/backend-node/src/services/coach/monitoring/generation/types.ts
COPY apps/backend-node/src/services/coach/monitoring/model.ts /app/apps/backend-node/src/services/coach/monitoring/model.ts
COPY apps/backend-node/src/services/coach/monitoring/service.ts /app/apps/backend-node/src/services/coach/monitoring/service.ts
COPY apps/backend-node/src/services/coach/monitoring/silence.ts /app/apps/backend-node/src/services/coach/monitoring/silence.ts
COPY apps/backend-node/src/services/coach/monitoring/types.ts /app/apps/backend-node/src/services/coach/monitoring/types.ts
COPY apps/backend-node/src/services/coach/tools/shareHeldProposal/tool.ts /app/apps/backend-node/src/services/coach/tools/shareHeldProposal/tool.ts
COPY apps/backend-node/src/services/coach/types.ts /app/apps/backend-node/src/services/coach/types.ts
COPY apps/backend-node/src/services/follow-through/onboarding/review.ts /app/apps/backend-node/src/services/follow-through/onboarding/review.ts
COPY apps/backend-node/src/services/loopsService.ts /app/apps/backend-node/src/services/loopsService.ts
COPY apps/backend-node/src/services/onboardingNotificationService.ts /app/apps/backend-node/src/services/onboardingNotificationService.ts
COPY apps/backend-node/src/services/perplexityAiService.ts /app/apps/backend-node/src/services/perplexityAiService.ts
COPY apps/backend-node/src/services/pineconeService.ts /app/apps/backend-node/src/services/pineconeService.ts
COPY apps/backend-node/src/services/planGenerationPipeline.ts /app/apps/backend-node/src/services/planGenerationPipeline.ts
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY apps/backend-node/src/services/recurringJobService.ts /app/apps/backend-node/src/services/recurringJobService.ts
COPY apps/backend-node/src/services/sesService.ts /app/apps/backend-node/src/services/sesService.ts
COPY apps/backend-node/src/services/supermemoryService.ts /app/apps/backend-node/src/services/supermemoryService.ts
COPY apps/backend-node/src/services/userService.ts /app/apps/backend-node/src/services/userService.ts
COPY apps/backend-node/src/services/webSearchService.ts /app/apps/backend-node/src/services/webSearchService.ts
COPY apps/backend-node/src/utils/aiConsent.ts /app/apps/backend-node/src/utils/aiConsent.ts
COPY apps/backend-node/src/utils/logger.ts /app/apps/backend-node/src/utils/logger.ts
COPY packages/prisma/activity-duplicates.ts /app/packages/prisma/activity-duplicates.ts
COPY packages/prisma/follow-through/coach-inbox.ts /app/packages/prisma/follow-through/coach-inbox.ts
COPY packages/prisma/follow-through/coaching.ts /app/packages/prisma/follow-through/coaching.ts
COPY packages/prisma/follow-through/session-format.ts /app/packages/prisma/follow-through/session-format.ts
# The image's own package.json is patched rather than replaced, so nothing live but not in this source is lost.
RUN node -e "\
const fs=require('fs');\
const p='/app/packages/prisma/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));\
const add={'./activity-duplicates':'./activity-duplicates.ts','./follow-through/coach-inbox':'./follow-through/coach-inbox.ts','./follow-through/session-format':'./follow-through/session-format.ts'};\
for(const[k,v]of Object.entries(add))if(j.exports[k]===undefined)j.exports[k]=v;\
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
LABEL tracking.feature="release-20261019"
