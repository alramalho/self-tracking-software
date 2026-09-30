ARG BASE_IMAGE=local/tracking-so-backend:streak-calendar-20260930
FROM ${BASE_IMAGE}
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
LABEL tracking.feature="circle-encouragement-20260930"
