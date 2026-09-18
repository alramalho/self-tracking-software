ARG BASE_IMAGE=local/tracking-so-backend:health-effort-20260915
FROM ${BASE_IMAGE}

# Preserve the current production backend and overlay only friend activity
# ranking. The native client already consumes this endpoint dynamically.
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/services/people/activity.ts /app/apps/backend-node/src/services/people/activity.ts
COPY apps/backend-node/src/services/people/rank.ts /app/apps/backend-node/src/services/people/rank.ts
COPY apps/backend-node/src/services/people/types.ts /app/apps/backend-node/src/services/people/types.ts
