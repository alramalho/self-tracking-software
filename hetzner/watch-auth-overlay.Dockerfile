ARG BASE_IMAGE=local/tracking-so-backend:ai-system-turns-20261007
FROM ${BASE_IMAGE}
# Watch auth answers 500, not 401, when the database fails, so the Apple Watch keeps its login.
COPY apps/backend-node/src/middleware/auth.ts /app/apps/backend-node/src/middleware/auth.ts
COPY apps/backend-node/src/routes/auth.ts /app/apps/backend-node/src/routes/auth.ts
LABEL tracking.feature="watch-auth-20261015"
# Live since 2026-10-15 14:31 UTC on top of ai-system-turns-20261007 (context tracking-watch-auth-20261015,
# activate.py verified health and endpoint codes; rollback.sh restores ai-system-turns). Main 2bb803e8's
# backend notificationService.ts change is not in this image.
