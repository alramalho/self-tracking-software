FROM local/tracking-so-backend:circle-proof-20260929
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/circles.ts /app/apps/backend-node/src/routes/circles.ts
COPY apps/backend-node/src/services/circles/chat.ts /app/apps/backend-node/src/services/circles/chat.ts
COPY apps/backend-node/src/services/circles/jobs.ts /app/apps/backend-node/src/services/circles/jobs.ts
COPY apps/backend-node/src/services/circles/service.ts /app/apps/backend-node/src/services/circles/service.ts
COPY packages/prisma/migrations/20260929150000_circle_chat/migration.sql /app/packages/prisma/migrations/20260929150000_circle_chat/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="circle-chat-20260929"
