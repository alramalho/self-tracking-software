ARG BASE_IMAGE=local/tracking-so-backend:watch-auth-20261015
FROM ${BASE_IMAGE}
# "How sure are you?": the onboarding and redesign drafts keep the person's confidence and why, the plan stores
# them (Plan.confidence), and the coach sees them and quotes the why back when the person slips.
COPY apps/backend-node/src/services/coach/agent.ts /app/apps/backend-node/src/services/coach/agent.ts
COPY apps/backend-node/src/services/coach/confidence.ts /app/apps/backend-node/src/services/coach/confidence.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/context.ts /app/apps/backend-node/src/services/coach/monitoring/generation/context.ts
COPY apps/backend-node/src/services/coach/monitoring/generation/service.ts /app/apps/backend-node/src/services/coach/monitoring/generation/service.ts
COPY apps/backend-node/src/services/follow-through/onboarding/service.ts /app/apps/backend-node/src/services/follow-through/onboarding/service.ts
COPY apps/backend-node/src/services/plan-design/apply.ts /app/apps/backend-node/src/services/plan-design/apply.ts
COPY apps/backend-node/src/services/plan-design/draft.ts /app/apps/backend-node/src/services/plan-design/draft.ts
COPY packages/prisma/follow-through/design.ts /app/packages/prisma/follow-through/design.ts
COPY packages/prisma/migrations/20261015120000_plan_confidence/migration.sql /app/packages/prisma/migrations/20261015120000_plan_confidence/migration.sql
# The image's own schema is patched in place rather than replaced, so nothing else that is live but not in
# this source can be lost.
RUN node -e "\
const fs=require('fs');\
const s='/app/packages/prisma/schema.prisma';let t=fs.readFileSync(s,'utf8');\
const a='  designedThrough DateTime? @db.Date\n';\
if(t.split(a).length!==2)throw new Error('schema anchor: designedThrough');\
if(!t.includes('  confidence      Json?\n')){\
  t=t.replace(a,a+'  // PlanConfidence: how sure the person was of this plan (1-10) and, in their words, why it was not lower.\n  confidence      Json?\n');\
  fs.writeFileSync(s,t);}"
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="plan-confidence-20261015"
# Live since 2026-10-15 16:30 UTC on top of watch-auth-20261015 (context tracking-plan-confidence-20261015,
# migration 20261015120000_plan_confidence applied after a database dump; rollback.sh restores watch-auth).
