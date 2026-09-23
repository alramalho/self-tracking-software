FROM local/tracking-so-backend:notification-navigation-b156
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/health.ts /app/apps/backend-node/src/routes/health.ts
COPY apps/backend-node/src/routes/notifications.ts /app/apps/backend-node/src/routes/notifications.ts
COPY apps/backend-node/src/services/activity-photo/delivery.ts /app/apps/backend-node/src/services/activity-photo/delivery.ts
COPY apps/backend-node/src/services/activity-photo/eligibility.ts /app/apps/backend-node/src/services/activity-photo/eligibility.ts
COPY apps/backend-node/src/services/activity-photo/notifications.ts /app/apps/backend-node/src/services/activity-photo/notifications.ts
COPY apps/backend-node/src/services/activity-photo/outbox.ts /app/apps/backend-node/src/services/activity-photo/outbox.ts
COPY apps/backend-node/src/services/activity-photo/types.ts /app/apps/backend-node/src/services/activity-photo/types.ts
COPY apps/backend-node/src/services/activity-photo/visibility.ts /app/apps/backend-node/src/services/activity-photo/visibility.ts
COPY apps/backend-node/src/services/cronScheduler.ts /app/apps/backend-node/src/services/cronScheduler.ts
COPY apps/backend-node/src/services/health/apple/effort.ts /app/apps/backend-node/src/services/health/apple/effort.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/schemas.ts /app/apps/backend-node/src/services/health/apple/reconciliation/schemas.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/service.ts /app/apps/backend-node/src/services/health/apple/reconciliation/service.ts
COPY apps/backend-node/src/services/health/apple/reconciliation/types.ts /app/apps/backend-node/src/services/health/apple/reconciliation/types.ts
COPY apps/backend-node/src/services/health/apple/schemas.ts /app/apps/backend-node/src/services/health/apple/schemas.ts
COPY apps/backend-node/src/services/health/apple/syncService.ts /app/apps/backend-node/src/services/health/apple/syncService.ts
COPY apps/backend-node/src/services/health/apple/types.ts /app/apps/backend-node/src/services/health/apple/types.ts
COPY apps/backend-node/src/services/health/garmin/normalization.ts /app/apps/backend-node/src/services/health/garmin/normalization.ts
COPY apps/backend-node/src/services/health/garmin/types.ts /app/apps/backend-node/src/services/health/garmin/types.ts
COPY apps/backend-node/src/services/notificationDestination.ts /app/apps/backend-node/src/services/notificationDestination.ts
COPY apps/backend-node/src/services/notificationService.ts /app/apps/backend-node/src/services/notificationService.ts
COPY apps/backend-node/src/services/recurringJobService.ts /app/apps/backend-node/src/services/recurringJobService.ts
COPY packages/prisma/migrations/20260918170000_add_health_workout_privacy_default/migration.sql /app/packages/prisma/migrations/20260918170000_add_health_workout_privacy_default/migration.sql
COPY packages/prisma/migrations/20260923010000_add_notification_dedupe_key/migration.sql /app/packages/prisma/migrations/20260923010000_add_notification_dedupe_key/migration.sql
COPY packages/prisma/migrations/20260923090000_activity_log_requests/migration.sql /app/packages/prisma/migrations/20260923090000_activity_log_requests/migration.sql
COPY packages/prisma/migrations/20260923091000_activity_photo_notification_outbox/migration.sql /app/packages/prisma/migrations/20260923091000_activity_photo_notification_outbox/migration.sql
COPY packages/prisma/migrations/20260923092000_photo_outbox_per_upload/migration.sql /app/packages/prisma/migrations/20260923092000_photo_outbox_per_upload/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature-commit="4320328d"
