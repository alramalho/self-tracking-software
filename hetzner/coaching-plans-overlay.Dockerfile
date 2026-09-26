FROM local/tracking-so-backend:ai-consent-20260925
COPY apps/backend-node/src/services/follow-through/onboarding/billing.ts /app/apps/backend-node/src/services/follow-through/onboarding/billing.ts
LABEL tracking.feature="coaching-plans-20260926"
