FROM local/tracking-so-backend:circles-20260929
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/circles.ts /app/apps/backend-node/src/routes/circles.ts
COPY apps/backend-node/src/services/circles/board/model.ts /app/apps/backend-node/src/services/circles/board/model.ts
COPY apps/backend-node/src/services/circles/board/service.ts /app/apps/backend-node/src/services/circles/board/service.ts
COPY apps/backend-node/src/services/circles/cards.ts /app/apps/backend-node/src/services/circles/cards.ts
COPY apps/backend-node/src/services/circles/config.ts /app/apps/backend-node/src/services/circles/config.ts
COPY apps/backend-node/src/services/circles/events.ts /app/apps/backend-node/src/services/circles/events.ts
COPY apps/backend-node/src/services/circles/jobs.ts /app/apps/backend-node/src/services/circles/jobs.ts
COPY apps/backend-node/src/services/circles/matching/service.ts /app/apps/backend-node/src/services/circles/matching/service.ts
COPY apps/backend-node/src/services/circles/nudges.ts /app/apps/backend-node/src/services/circles/nudges.ts
COPY apps/backend-node/src/services/circles/service.ts /app/apps/backend-node/src/services/circles/service.ts
COPY apps/backend-node/src/services/circles/timeline.ts /app/apps/backend-node/src/services/circles/timeline.ts
COPY apps/backend-node/src/services/circles/types.ts /app/apps/backend-node/src/services/circles/types.ts
COPY packages/prisma/migrations/20260929120000_circle_proof/migration.sql /app/packages/prisma/migrations/20260929120000_circle_proof/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="circle-proof-20260929"
