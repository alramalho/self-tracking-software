FROM local/tracking-so-backend:streak-20260925
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/utils/userSelfUpdate.ts /app/apps/backend-node/src/utils/userSelfUpdate.ts
LABEL tracking.feature="user-update-guard-20260925"
