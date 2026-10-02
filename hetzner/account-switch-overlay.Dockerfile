ARG BASE_IMAGE
FROM ${BASE_IMAGE}

# Keep the active production image intact while adding account switching:
# switch tokens a device trades for a Clerk sign-in ticket.
COPY apps/backend-node/src/routes/auth.ts /app/apps/backend-node/src/routes/auth.ts
COPY apps/backend-node/src/services/auth/switchTokenService.ts /app/apps/backend-node/src/services/auth/switchTokenService.ts
COPY apps/backend-node/src/services/auth/types.ts /app/apps/backend-node/src/services/auth/types.ts
COPY packages/prisma/migrations/20261001160000_add_account_switch_tokens /app/packages/prisma/migrations/20261001160000_add_account_switch_tokens
COPY hetzner/account-switch/add-schema-model.cjs /tmp/add-schema-model.cjs

RUN node /tmp/add-schema-model.cjs /app/packages/prisma/schema.prisma \
  && pnpm --dir /app/packages/prisma exec prisma generate
