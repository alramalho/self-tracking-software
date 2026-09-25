FROM local/tracking-so-backend:user-update-guard-20260925
COPY apps/backend-node/src/index.ts /app/apps/backend-node/src/index.ts
COPY apps/backend-node/src/middleware/auth.ts /app/apps/backend-node/src/middleware/auth.ts
COPY apps/backend-node/src/routes/achievements.ts /app/apps/backend-node/src/routes/achievements.ts
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/admin.ts /app/apps/backend-node/src/routes/admin.ts
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/garmin.ts /app/apps/backend-node/src/routes/garmin.ts
COPY apps/backend-node/src/routes/moderation.ts /app/apps/backend-node/src/routes/moderation.ts
COPY apps/backend-node/src/routes/notifications.ts /app/apps/backend-node/src/routes/notifications.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/services/follow-through/circles/service.ts /app/apps/backend-node/src/services/follow-through/circles/service.ts
COPY apps/backend-node/src/services/health/garmin/service.ts /app/apps/backend-node/src/services/health/garmin/service.ts
COPY apps/backend-node/src/services/memoryService.ts /app/apps/backend-node/src/services/memoryService.ts
COPY apps/backend-node/src/services/recommendationsService.ts /app/apps/backend-node/src/services/recommendationsService.ts
COPY apps/backend-node/src/services/s3Service.ts /app/apps/backend-node/src/services/s3Service.ts
COPY apps/backend-node/src/services/sesService.ts /app/apps/backend-node/src/services/sesService.ts
COPY apps/backend-node/src/utils/blocks.ts /app/apps/backend-node/src/utils/blocks.ts
COPY apps/backend-node/src/utils/userSelfUpdate.ts /app/apps/backend-node/src/utils/userSelfUpdate.ts
COPY packages/prisma/migrations/20260925120000_content_reports_and_user_blocks/migration.sql /app/packages/prisma/migrations/20260925120000_content_reports_and_user_blocks/migration.sql
COPY packages/prisma/migrations/20260925130000_user_suspension/migration.sql /app/packages/prisma/migrations/20260925130000_user_suspension/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="app-store-safety-20260925"
