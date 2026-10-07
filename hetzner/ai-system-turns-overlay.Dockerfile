ARG BASE_IMAGE=local/tracking-so-backend:voice-languages-20261002
FROM ${BASE_IMAGE}
# Coach notes use instructions; structured and text helpers accept trusted system turns (AI SDK 7).
COPY apps/backend-node/src/services/aiService.ts /app/apps/backend-node/src/services/aiService.ts
LABEL tracking.feature="ai-system-turns-20261007"
