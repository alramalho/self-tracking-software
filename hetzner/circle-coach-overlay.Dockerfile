FROM local/tracking-so-backend:circle-chat-20260929
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/services/circles/board/model.ts /app/apps/backend-node/src/services/circles/board/model.ts
COPY apps/backend-node/src/services/circles/chat.ts /app/apps/backend-node/src/services/circles/chat.ts
COPY apps/backend-node/src/services/circles/coach/model.ts /app/apps/backend-node/src/services/circles/coach/model.ts
COPY apps/backend-node/src/services/circles/coach/service.ts /app/apps/backend-node/src/services/circles/coach/service.ts
COPY apps/backend-node/src/services/circles/config.ts /app/apps/backend-node/src/services/circles/config.ts
COPY apps/backend-node/src/services/circles/jobs.ts /app/apps/backend-node/src/services/circles/jobs.ts
COPY apps/backend-node/src/services/circles/notify.ts /app/apps/backend-node/src/services/circles/notify.ts
COPY apps/backend-node/src/services/circles/service.ts /app/apps/backend-node/src/services/circles/service.ts
COPY packages/prisma/migrations/20260929160000_circles_board_from_two/migration.sql /app/packages/prisma/migrations/20260929160000_circles_board_from_two/migration.sql
LABEL tracking.feature="circle-coach-20260929"
