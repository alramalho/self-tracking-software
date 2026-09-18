ARG BASE_IMAGE=local/tracking-so-backend:health-vitals-20260916d
FROM ${BASE_IMAGE}

# Preserve the latest production Health and friend-ordering rollout while
# overlaying only onboarding context/prompt behavior and the STT model choice.
COPY apps/backend-node/src/routes/followThrough.ts /app/apps/backend-node/src/routes/followThrough.ts
COPY apps/backend-node/src/services/follow-through/onboarding/interview/context.ts /app/apps/backend-node/src/services/follow-through/onboarding/interview/context.ts
COPY apps/backend-node/src/services/follow-through/onboarding/interview/service.ts /app/apps/backend-node/src/services/follow-through/onboarding/interview/service.ts
COPY apps/backend-node/src/services/follow-through/onboarding/interview/types.ts /app/apps/backend-node/src/services/follow-through/onboarding/interview/types.ts
COPY apps/backend-node/src/services/stt/config.ts /app/apps/backend-node/src/services/stt/config.ts
