ARG BASE_IMAGE=local/tracking-so-backend:account-switch-20261001
FROM ${BASE_IMAGE}
# satori draws the invite preview images (text as paths, so the image needs no system fonts).
# Installed on its own (the image's lockfile can't install), then added to the backend's node_modules.
RUN mkdir -p /tmp/satori-lib && cd /tmp/satori-lib && npm init -y >/dev/null && npm install --no-audit --no-fund satori@0.33.5 \
 && cd /tmp/satori-lib/node_modules && for p in $(ls -d @*/* [!@]* 2>/dev/null); do \
      [ -e "/app/apps/backend-node/node_modules/$p" ] || { mkdir -p "/app/apps/backend-node/node_modules/$(dirname "$p")"; cp -R "$p" "/app/apps/backend-node/node_modules/$p"; }; \
    done && rm -rf /tmp/satori-lib \
 && node -e "console.log('satori', typeof require('/app/apps/backend-node/node_modules/satori').default)"
COPY apps/backend-node/assets/og/Inter-Bold.ttf /app/apps/backend-node/assets/og/Inter-Bold.ttf
COPY apps/backend-node/assets/og/Inter-Regular.ttf /app/apps/backend-node/assets/og/Inter-Regular.ttf
COPY apps/backend-node/assets/og/app-icon.png /app/apps/backend-node/assets/og/app-icon.png
COPY apps/backend-node/assets/og/circle.png /app/apps/backend-node/assets/og/circle.png
COPY apps/backend-node/assets/og/start.png /app/apps/backend-node/assets/og/start.png
COPY apps/backend-node/assets/og/welcome.png /app/apps/backend-node/assets/og/welcome.png
COPY apps/backend-node/src/index.ts /app/apps/backend-node/src/index.ts
COPY apps/backend-node/src/routes/chats.ts /app/apps/backend-node/src/routes/chats.ts
COPY apps/backend-node/src/routes/circles.ts /app/apps/backend-node/src/routes/circles.ts
COPY apps/backend-node/src/routes/og.ts /app/apps/backend-node/src/routes/og.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/services/circles/board/model.ts /app/apps/backend-node/src/services/circles/board/model.ts
COPY apps/backend-node/src/services/circles/board/service.ts /app/apps/backend-node/src/services/circles/board/service.ts
COPY apps/backend-node/src/services/circles/coach/model.ts /app/apps/backend-node/src/services/circles/coach/model.ts
COPY apps/backend-node/src/services/circles/coach/service.ts /app/apps/backend-node/src/services/circles/coach/service.ts
COPY apps/backend-node/src/services/circles/config.ts /app/apps/backend-node/src/services/circles/config.ts
COPY apps/backend-node/src/services/circles/notify.ts /app/apps/backend-node/src/services/circles/notify.ts
COPY apps/backend-node/src/services/circles/service.ts /app/apps/backend-node/src/services/circles/service.ts
COPY apps/backend-node/src/services/circles/timeline.ts /app/apps/backend-node/src/services/circles/timeline.ts
COPY apps/backend-node/src/services/circles/types.ts /app/apps/backend-node/src/services/circles/types.ts
COPY apps/backend-node/src/services/og/card.ts /app/apps/backend-node/src/services/og/card.ts
COPY apps/backend-node/src/services/og/circleInvite.ts /app/apps/backend-node/src/services/og/circleInvite.ts
COPY apps/backend-node/src/services/og/render.ts /app/apps/backend-node/src/services/og/render.ts
COPY packages/prisma/migrations/20261001170000_circle_momentum/migration.sql /app/packages/prisma/migrations/20261001170000_circle_momentum/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
# The schema gained Circle.coachPosts and CircleMember.muted (on top of the live account switch model).
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="circle-momentum-20261001"
