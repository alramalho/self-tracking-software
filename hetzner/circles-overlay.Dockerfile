FROM local/tracking-so-backend:streak-hold-20260928
COPY apps/backend-node/src/routes/activities.ts /app/apps/backend-node/src/routes/activities.ts
COPY apps/backend-node/src/routes/admin.ts /app/apps/backend-node/src/routes/admin.ts
COPY apps/backend-node/src/routes/circles.ts /app/apps/backend-node/src/routes/circles.ts
COPY apps/backend-node/src/routes/moderation.ts /app/apps/backend-node/src/routes/moderation.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/services/circles/board/model.ts /app/apps/backend-node/src/services/circles/board/model.ts
COPY apps/backend-node/src/services/circles/board/service.ts /app/apps/backend-node/src/services/circles/board/service.ts
COPY apps/backend-node/src/services/circles/cards.ts /app/apps/backend-node/src/services/circles/cards.ts
COPY apps/backend-node/src/services/circles/config.ts /app/apps/backend-node/src/services/circles/config.ts
COPY apps/backend-node/src/services/circles/errors.ts /app/apps/backend-node/src/services/circles/errors.ts
COPY apps/backend-node/src/services/circles/jobs.ts /app/apps/backend-node/src/services/circles/jobs.ts
COPY apps/backend-node/src/services/circles/matching/levers.ts /app/apps/backend-node/src/services/circles/matching/levers.ts
COPY apps/backend-node/src/services/circles/matching/profiles.ts /app/apps/backend-node/src/services/circles/matching/profiles.ts
COPY apps/backend-node/src/services/circles/matching/service.ts /app/apps/backend-node/src/services/circles/matching/service.ts
COPY apps/backend-node/src/services/circles/notify.ts /app/apps/backend-node/src/services/circles/notify.ts
COPY apps/backend-node/src/services/circles/nudges.ts /app/apps/backend-node/src/services/circles/nudges.ts
COPY apps/backend-node/src/services/circles/previews.ts /app/apps/backend-node/src/services/circles/previews.ts
COPY apps/backend-node/src/services/circles/service.ts /app/apps/backend-node/src/services/circles/service.ts
COPY apps/backend-node/src/services/circles/timeline.ts /app/apps/backend-node/src/services/circles/timeline.ts
COPY apps/backend-node/src/services/circles/types.ts /app/apps/backend-node/src/services/circles/types.ts
COPY apps/backend-node/src/services/cronScheduler.ts /app/apps/backend-node/src/services/cronScheduler.ts
COPY apps/backend-node/src/services/follow-through/onboarding/schema.ts /app/apps/backend-node/src/services/follow-through/onboarding/schema.ts
COPY packages/prisma/follow-through/types.ts /app/packages/prisma/follow-through/types.ts
COPY packages/prisma/migrations/20260929090000_circles/migration.sql /app/packages/prisma/migrations/20260929090000_circles/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
# sharp makes the blurred circle photo previews. Installed on its own (the image's lockfile can't
# install), with the Linux musl build that this Alpine image needs, then added to the backend's node_modules.
RUN mkdir -p /tmp/sharp-lib && cd /tmp/sharp-lib && npm init -y >/dev/null && npm install --no-audit --no-fund sharp@0.34.5 \
 && cd /tmp/sharp-lib/node_modules && for p in $(ls -d @*/* [!@]* 2>/dev/null); do \
      [ -e "/app/apps/backend-node/node_modules/$p" ] || { mkdir -p "/app/apps/backend-node/node_modules/$(dirname "$p")"; cp -R "$p" "/app/apps/backend-node/node_modules/$p"; }; \
    done && rm -rf /tmp/sharp-lib \
 && node -e "require('/app/apps/backend-node/node_modules/sharp')({create:{width:2,height:2,channels:3,background:'#fff'}}).jpeg().toBuffer().then(b=>console.log('sharp ok',b.length))"
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="circles-20260929"
