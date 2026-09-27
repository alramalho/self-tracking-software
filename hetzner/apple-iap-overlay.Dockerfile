FROM local/tracking-so-backend:coaching-plans-20260926
COPY apps/backend-node/certs/apple/AppleIncRootCertificate.cer /app/apps/backend-node/certs/apple/AppleIncRootCertificate.cer
COPY apps/backend-node/certs/apple/AppleRootCA-G2.cer /app/apps/backend-node/certs/apple/AppleRootCA-G2.cer
COPY apps/backend-node/certs/apple/AppleRootCA-G3.cer /app/apps/backend-node/certs/apple/AppleRootCA-G3.cer
COPY apps/backend-node/src/index.ts /app/apps/backend-node/src/index.ts
COPY apps/backend-node/src/routes/appleBilling.ts /app/apps/backend-node/src/routes/appleBilling.ts
COPY apps/backend-node/src/routes/stripe.ts /app/apps/backend-node/src/routes/stripe.ts
COPY apps/backend-node/src/utils/userSelfUpdate.ts /app/apps/backend-node/src/utils/userSelfUpdate.ts
COPY packages/prisma/migrations/20260927100000_user_apple_subscription/migration.sql /app/packages/prisma/migrations/20260927100000_user_apple_subscription/migration.sql
COPY packages/prisma/schema.prisma /app/packages/prisma/schema.prisma
# The image's workspace lockfile can't install (it lists app-only packages), so install Apple's library
# on its own and add it (and any dependency not already present) to the backend's node_modules.
RUN mkdir -p /tmp/apple-lib && cd /tmp/apple-lib && npm init -y >/dev/null && npm install --no-audit --no-fund @apple/app-store-server-library@3.1.0 \
 && cd /tmp/apple-lib/node_modules && for p in $(ls -d @*/* [!@]* 2>/dev/null); do \
      [ -e "/app/apps/backend-node/node_modules/$p" ] || { mkdir -p "/app/apps/backend-node/node_modules/$(dirname "$p")"; cp -R "$p" "/app/apps/backend-node/node_modules/$p"; }; \
    done && rm -rf /tmp/apple-lib
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="apple-iap-20260927"
