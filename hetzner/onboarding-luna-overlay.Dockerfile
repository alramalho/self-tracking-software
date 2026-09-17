ARG BASE_IMAGE=local/tracking-so-backend:onboarding-parakeet-20260916b
FROM ${BASE_IMAGE}

# Onboarding semantic gate: switched from openai/gpt-5.6-terra at the provider
# default effort to openai/gpt-5.6-luna at reasoningEffort "xhigh", and a failed
# check now rewrites the reply instead of demoting an acceptance in place.
# Overlays only the four files this change touches.
COPY apps/backend-node/src/services/aiModelIds.ts /app/apps/backend-node/src/services/aiModelIds.ts
COPY apps/backend-node/src/services/aiService.ts /app/apps/backend-node/src/services/aiService.ts
COPY apps/backend-node/src/services/follow-through/onboarding/interview/service.ts /app/apps/backend-node/src/services/follow-through/onboarding/interview/service.ts
COPY apps/backend-node/src/services/follow-through/onboarding/service.ts /app/apps/backend-node/src/services/follow-through/onboarding/service.ts
