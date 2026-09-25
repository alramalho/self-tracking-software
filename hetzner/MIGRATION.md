# Backend migration: AWS → Hetzner

## Goal

Run the `tracking.so` backend and PostgreSQL database on the Hetzner VM. Keep Pinecone, Clerk, Stripe, and AWS S3/SES as external services.

## Status

### Done
- **VM**: `tsw-backend` (CPX32, 4 vCPU / 8 GB / 160 GB, `hel1`) at `89.167.84.67` / `2a01:4f9:c014:5c59::1`. ~€13.6/mo.
- **Bootstrap**: Docker 29.4.1, Docker Compose v5.1.3, UFW 22/80/443 (via [cloud-init.yaml](./cloud-init.yaml))
- **Stack on box**: backend container + Caddy 2 TLS termination → Let's Encrypt ([docker-compose.yml](./docker-compose.yml), [Caddyfile](./Caddyfile)). Active remote deployment directory is `/root/workspace/tracking.so/deployment`.
- **Database**: PostgreSQL 16 + pgvector runs in the shared `platform-postgres` container. Production uses the `tracking_cutover` database through the root-only `database-local.env` file.
- **DNS**: `api-hetzner.tracking.so` and `api.tracking.so` A + AAAA resolve to Hetzner.
- **Deploy**: currently GitHub Actions/GHCR-backed on the box; local manual deploy script exists but is not the active remote layout. Treat [hetzner/.env.prod](./.env.prod) as the local secret source of truth for the Hetzner runtime env.
- **Env**: active box env has `API_DOMAIN=api-hetzner.tracking.so, api.tracking.so`, so Caddy serves both hostnames.
- **Error-notifier cleanup**: [errorHandler.ts](../apps/backend-node/src/middleware/errorHandler.ts) now pages only on 5xx; killed the `allowed-routes.txt` / WAF allow-list premise
- **Telegram alert routing**: `@trackingso_bot` retains routine activity in the original private destination while `TELEGRAM_ALERT_CHAT_IDS` routes 5xx, Stripe, important bug/account and CI events to **Important App Alerts**. Production connection and a real group delivery passed September 15, 2026. Run `docker exec tsw-backend pnpm check-telegram -- --require-dedicated-alerts` after env or bot-membership changes.
- **Native push transport**: the existing Apple `.p8` key is stored only at `deployment/secrets/apns-key.p8` (mode 600) and mounted read-only at `/run/secrets/apns-key.p8`; `.dockerignore` excludes all `.p8` files. Production startup logs confirmed the APNs provider initialized September 15, 2026.
- **Preserved Health effort overlay**: `local/tracking-so-backend:health-effort-20260915`, derived from `stt-openrouter-20260915`, is the direct base of the active people image. It stores Apple user/estimated workout effort and average/maximum heart rate in existing Health workout metadata, maps effort into the existing five difficulty choices and preserves a difficulty already chosen by the user. No database migration was required. Build context is `deployment/tracking-health-effort-deploy/`; rollback environment backup is `deployment/.env.before-health-effort-20260915`.
- **Current people activity overlay**: production runs `local/tracking-so-backend:people-activity-20260916`, derived from `health-effort-20260915`. The empty friend search ranks accepted connections by non-deleted activity-entry count, then latest activity and username. Text searches keep match quality first and use activity only as a tie-breaker. No response fields or database schema changed. Build context is `deployment/tracking-people-activity-deploy/`; rollback environment backup is `deployment/.env.before-people-activity-20260916`.
- **Current onboarding/Parakeet overlay**: production runs `local/tracking-so-backend:onboarding-parakeet-20260916b`, derived from the latest Health-vitals image. STT uses OpenRouter `nvidia/parakeet-tdt-0.6b-v3`. The onboarding interview receives the signed-in user's active activity catalog and non-deleted log history, so it does not ask how often an already-known activity is performed or claim it cannot inspect that activity. No schema migration was required. Build context is `deployment/tracking-onboarding-parakeet-deploy/`; rollback environment backup is `deployment/.env.before-onboarding-parakeet-20260916b`.
- **Preserved STT layer**: `local/tracking-so-backend:stt-openrouter-20260915` derives from `interview-health-20260915` with only `sttService.ts` and its new `stt/config.ts` / `stt/types.ts`. The later Health, people and onboarding overlays retain it. The current default is OpenRouter `nvidia/parakeet-tdt-0.6b-v3` when `OPENROUTER_API_KEY` is configured, with the direct OpenAI `whisper-1` fallback when it is not. The key exists only in the root-owned runtime env. Build context is `deployment/tracking-stt-openrouter-deploy/`; rollback env backup is `deployment/.env.before-stt-openrouter-image-20260915`.
- **Preserved Watch ordering layer**: `local/tracking-so-backend:watch-order-20260915` derives from `notifications-labeled-20260915` with only the activity-list route and new `services/activities/list.ts`; the later interview, STT and Health effort images retain it. The existing `/activities/` response sorts by each user's nondeleted log count, descending, preserving newest-first ties and its response shape. Build context is `deployment/tracking-watch-order-deploy/`; rollback environment backup is `deployment/.env.before-watch-order-20260915`.
- **Preserved notification overlay**: the Watch ordering image inherits local image `local/tracking-so-backend:notifications-labeled-20260915`, derived only from the prior `weekly-profile-20260915` image after comparing each overlaid source file with the running container. It contains Telegram routing/checks plus APNs stale-token classification; include these source changes in the next normal backend image. The root-only pre-change env and compose backups are `deployment/.env.before-alert-routing-20260915` and `deployment/docker-compose.yml.before-alert-routing-20260915`.
- **Verified**: `https://api-hetzner.tracking.so/health` → `{"status":"ok"}` HTTP 200 via Caddy.
- **Web smoke test**: `stage.tracking.so` serves the staging frontend from the VPS. Clerk login and authenticated user, activity, metric, plan, chat, and timeline reads were verified against the VPS database.
- **Production cutover**: `app.tracking.so` now reaches Hetzner through `https://api.tracking.so`; verified `/health` via Caddy and production login/data loading after adding missing `messages.readAt`.

## Native onboarding clarification hotfix — September 18, 2026

Production now runs `local/tracking-so-backend:interview-clarification-20260918`, built from `local/tracking-so-backend:friends-entry-count-20260918`. It accepts the legacy duration transport field during rollout so existing clients can save clarification answers, then strips that field before the clarification facts reach the model. Clarification facts remain separate from operational session generation. No database migration was required.

Prepared server context: `/root/workspace/tracking.so/deployment/tracking-interview-clarification-20260918/`. The context contains the four scoped source overlays and `source-hashes.json`; verification confirmed all four hashes, healthy container state, public `/health` HTTP 200 and unauthenticated protected routes returning HTTP 401. The pre-activation environment backup is `/root/workspace/tracking.so/deployment/.env.before-interview-clarification-20260918`.

Repeatable build, activation and verification:

```sh
cd /root/workspace/tracking.so/deployment
docker build -t local/tracking-so-backend:interview-clarification-20260918 tracking-interview-clarification-20260918
python3 tracking-interview-clarification-20260918/activate.py
python3 tracking-interview-clarification-20260918/verify.py
```

Rollback by restoring `.env.before-interview-clarification-20260918` to `.env`, preserving mode 600, recreating only `backend`, and checking `/health`. The activation script refuses a second activation when its rollback backup already exists.

### Inventory captured (for teardown)
- **Flightcontrol-managed** (former prod): ECS cluster + service `fc-web-server-dvrpa1-6ba11x8`, ALB with same name, VPC `fc-self-tracking-software-0nb10m`. Must be torn down **via Flightcontrol dashboard**, not AWS console.
- **CDK-managed remnants**: `TrackingSoftwareInfrastructureStackproductionApiStack070335E4` (WAF only — Fargate code already commented out), parent stack, plus sandbox/dev stacks.
- **Cron proxy Lambda**: `trackingSoftwareApiCronProxyLambdasandbox` (sandbox only — prod cron is now `node-cron` inside the app)
- **DNS authority**: `tracking.so` is managed by Namecheap / `registrar-servers.com`, not by the Route53 zone in this AWS account. Old prod record was `api.tracking.so CNAME d1eevim432y2yu.cloudfront.net`; rollback is to restore that CNAME.
- **Route53 zone**: `api.tracking.so.` exists in AWS account `854257060653` but only has NS/SOA and is not currently authoritative for production traffic.
- **Other projects in this AWS account** (reddit­leads, jarvis, yThinkingApp, agr, BuildingIdentifier, HippoPrototype, Fidel) — **out of scope**, not touching

## Open TODOs

### Cutover
- **Completed 2026-05-07**: In Namecheap DNS, replaced `api.tracking.so CNAME d1eevim432y2yu.cloudfront.net` with:
  - `A api 89.167.84.67`
  - `AAAA api 2a01:4f9:c014:5c59::1`
- Recreated Caddy on the box with `API_DOMAIN=api-hetzner.tracking.so, api.tracking.so`; Caddy obtained/served the `api.tracking.so` certificate.
- Verified `https://api.tracking.so/health` returns 200 with `via: 1.1 Caddy` and no CloudFront headers.
- Legacy AWS/Flightcontrol backend deploy workflows were removed after cutover. Rollback now requires intentionally restoring old infrastructure/DNS instead of happening through CI.

### Known post-cutover gaps
- **Expo token refresh still needs a new device build** — the production APNs provider is fixed, but the most recently stored pre-Expo token was rejected by Apple as `BadDeviceToken`. The Expo source now reconciles granted notification permission with a fresh raw APNs token and unregisters on logout. Build 26 predates that source fix: on build 26, toggle Settings → Push Notifications off and on to refresh immediately. A later signed build must physically confirm receipt before native push is called fully validated.
- **Schema drift hotfix** — Hetzner exposed a missing production DB column, `messages.readAt`, used by `/chats`. It was hotfixed in prod and recorded in [20260507163500_add_message_read_at](../packages/prisma/migrations/20260507163500_add_message_read_at/migration.sql).

### AWS/Flightcontrol teardown
1. Stop the Flightcontrol project (Flightcontrol dashboard) — this removes ECS/ALB/VPC/NAT/SGs.
2. `aws cloudformation delete-stack --stack-name TrackingSoftwareInfrastructureStackproductionApiStack070335E4` (WAF) + parent stack.
3. Clean up sandbox/dev CDK stacks: `TrackingSoftwareInfrastructureStackdev*`, `TrackingSoftwareInfrastructureStacksandbox*`.
4. Delete `trackingSoftwareApiCronProxyLambdasandbox`.
5. Verify next-day Cost Explorer shows ECS/ELB/WAF lines at 0.

### Nice-to-haves (after teardown is stable)
- **Log shipping**: compose is wired for Fluent Bit → Better Stack. Deployment requires `BETTERSTACK_INGESTING_HOST` and `BETTERSTACK_SOURCE_TOKEN` in the Hetzner runtime env.
- **Backups**: PostgreSQL is now self-managed. Add encrypted off-host database backups and a Hetzner snapshot schedule before removing the temporary cutover dump.
- **Healthcheck false-positive**: compose reports backend `unhealthy` despite serving 200s — `wget` check needs tuning or swap to a curl-based probe.
- **Separate AWS cleanup pass** for the unrelated dead-side-project stacks (Fidel '22, HippoPrototype '23, Jarvis, AGR, BuildingIdentifier, yThinkingApp, parts of redditleads). Likely ~$5-15/mo cumulative.

## Rollback plan

If Hetzner has issues after teardown, rollback is no longer a one-DNS-record operation. Recreate or re-enable backend infrastructure first, then repoint `api.tracking.so` in Namecheap.


## Native interview and Apple Health V0 — September 15, 2026

Backend image `local/tracking-so-backend:interview-health-20260915` is retained in the active image chain beneath the STT and Health effort overlays. It derives from `watch-order-20260915`, preserving Watch usage ordering and the earlier notification/follow-through fixes. The scoped overlay changes 19 source/type/script files: the AI interview endpoint/schema, resumable draft fields, stored motivation/baseline, Health sleep scores/reconciliation preferences and Health-to-AI activity filters. No database migration or destructive backfill is required.

Context on the server: `/root/workspace/tracking.so/deployment/tracking-interview-health-deploy/`. `source-hashes.json` lists the scope; `baseline/` preserves the pre-deployment sources. `verify.py` confirms all 19 deployed hashes, HTTP 200 health and HTTP 401 for unauthenticated interview/sleep/activities. `evidence/deployment-verified.json` records the result. Six synthetic live AI checks passed in the prepared image without production database writes. The temporary gateway env file was removed. Do not copy production credentials into repository files.

Deployment from the existing prepared context:

```sh
cd /root/workspace/tracking.so/deployment
# Build first; the activation script validates the expected prior image and saves rollback state.
docker build -t local/tracking-so-backend:interview-health-20260915 tracking-interview-health-deploy
python3 tracking-interview-health-deploy/activate.py
python3 tracking-interview-health-deploy/verify.py
```

The activation script intentionally refuses a second activation if its backup exists. Rollback restores `.env.before-interview-health-20260915` to `.env`, then runs `docker compose up -d --no-deps backend` and checks `/health`. Preserve permissions (600) and do not print environment contents. Do not remove the existing `tsw-backend-localdb` orphan container. A later deployment must retain this source overlay or deploy the equivalent repository changes.

Client scope and validation: [native onboarding interview](../docs/native-onboarding-interview.md), [Health V0](../docs/native-health-v0.md). The current payment flow still uses the existing web checkout; this is not a StoreKit/App Store billing deployment.

## Native dictation STT overlay — September 15, 2026

Image `local/tracking-so-backend:stt-openrouter-20260915` is retained as the direct base of the active Health effort image. The scoped Dockerfile is [stt-openrouter-overlay.Dockerfile](./stt-openrouter-overlay.Dockerfile); it deliberately overlays only the three STT runtime files on `interview-health-20260915` so unrelated local worktree changes are not deployed. The prepared server context is `/root/workspace/tracking.so/deployment/tracking-stt-openrouter-deploy/`.

Repeatable build and activation on the server:

```sh
cd /root/workspace/tracking.so/deployment
docker build \
  --build-arg BASE_IMAGE=local/tracking-so-backend:interview-health-20260915 \
  -f tracking-stt-openrouter-deploy/hetzner/stt-openrouter-overlay.Dockerfile \
  -t local/tracking-so-backend:stt-openrouter-20260915 \
  tracking-stt-openrouter-deploy
cp -p .env .env.before-stt-openrouter-image-20260915
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:stt-openrouter-20260915|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
```

Rollback by restoring `.env.before-stt-openrouter-image-20260915` to `.env`, preserving mode 600, then recreate only `backend` and verify `/health`. Never print or copy the OpenRouter credential into tracked files, app configuration or build artifacts.

## Apple Health workout effort overlay — September 16, 2026

Image `local/tracking-so-backend:health-effort-20260915` is retained as the direct base of the active people image. The scoped [health-effort-overlay.Dockerfile](./health-effort-overlay.Dockerfile) builds on `stt-openrouter-20260915` and overlays only the Apple Health ingestion, effort mapping and reconciliation files. Raw Apple effort/heart-rate summaries use the existing `HealthWorkout.metadata` JSON, so activation required no Prisma migration or backfill.

Prepared server context: `/root/workspace/tracking.so/deployment/tracking-health-effort-deploy/`. The six deployed source hashes match the local files. Verification confirmed `/health` HTTP 200, unauthenticated Health routes HTTP 401, healthy container state, and retained APNs/OpenRouter initialization. The pre-activation environment is `/root/workspace/tracking.so/deployment/.env.before-health-effort-20260915`.

Repeatable build and activation on the server:

```sh
cd /root/workspace/tracking.so/deployment
docker build \
  --build-arg BASE_IMAGE=local/tracking-so-backend:stt-openrouter-20260915 \
  -f tracking-health-effort-deploy/hetzner/health-effort-overlay.Dockerfile \
  -t local/tracking-so-backend:health-effort-20260915 \
  tracking-health-effort-deploy
cp -p .env .env.before-health-effort-20260915
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:health-effort-20260915|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
curl --fail --silent https://api.tracking.so/health
```

Rollback by restoring `.env.before-health-effort-20260915` to `.env`, preserving mode 600, recreating only `backend`, and checking `/health`. The rollback returns to the STT image and therefore removes backend acceptance of the new effort fields; use it only with clients that tolerate those fields being ignored or after investigating the failure.

## Friend activity ordering overlay — September 16, 2026

Production image `local/tracking-so-backend:people-activity-20260916` is active and healthy. The scoped [people-activity-overlay.Dockerfile](./people-activity-overlay.Dockerfile) builds on `health-effort-20260915` and overlays only the user search route plus the three people-ranking files. Empty friend searches sort by non-deleted activity-entry count, then most recent activity and username. Text searches retain match quality as the primary ranking. The response shape is unchanged, and no migration or backfill was required.

Prepared server context: `/root/workspace/tracking.so/deployment/tracking-people-activity-deploy/`. All four deployed hashes match the local source. Verification confirmed container and public health, authentication enforcement, retained APNs/OpenRouter startup, and descending activity ordering over a real 23-person production connection graph. The pre-activation environment is `/root/workspace/tracking.so/deployment/.env.before-people-activity-20260916`.

Repeatable build and activation on the server:

```sh
cd /root/workspace/tracking.so/deployment
docker build \
  --build-arg BASE_IMAGE=local/tracking-so-backend:health-effort-20260915 \
  -f tracking-people-activity-deploy/hetzner/people-activity-overlay.Dockerfile \
  -t local/tracking-so-backend:people-activity-20260916 \
  tracking-people-activity-deploy
cp -p .env .env.before-people-activity-20260916
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:people-activity-20260916|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
curl --fail --silent https://api.tracking.so/health
```

Rollback by restoring `.env.before-people-activity-20260916` to `.env`, preserving mode 600, recreating only `backend`, and checking `/health`. That returns to the Health/STT image while removing only activity-based friend ordering.

## Onboarding Parakeet and activity-context overlay — September 16, 2026

Production image `local/tracking-so-backend:onboarding-parakeet-20260916b` is active and healthy, built from the latest `health-vitals-20260916d` image. It overlays the interview route/context/prompt and STT config only. The app uses OpenRouter `nvidia/parakeet-tdt-0.6b-v3`; the provider key remains in the root-owned runtime environment. The onboarding context query is read-only and returns at most 20 active user activities with non-deleted log counts and latest log dates. No schema migration or client rebuild is required.

Repeatable build and activation on the server:

```sh
cd /root/workspace/tracking.so/deployment
docker build \
  --build-arg BASE_IMAGE=local/tracking-so-backend:health-vitals-20260916d \
  -f tracking-onboarding-parakeet-deploy/hetzner/onboarding-parakeet-overlay.Dockerfile \
  -t local/tracking-so-backend:onboarding-parakeet-20260916b \
  tracking-onboarding-parakeet-deploy
cp -p .env .env.before-onboarding-parakeet-20260916b
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:onboarding-parakeet-20260916b|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
curl --fail --silent https://api.tracking.so/health
```

Verification passed: source hashes match, container health is `healthy`, startup selects Parakeet, public `/health` is 200, unauthenticated onboarding remains 401, and the live Parakeet service transcribed a synthetic M4A accurately. Rollback by restoring `.env.before-onboarding-parakeet-20260916b` to `.env`, preserving mode 600, recreating only `backend`, and checking `/health`.

## Apple Health vitals/privacy overlay — September 16, 2026

Production image `local/tracking-so-backend:health-vitals-20260916d` is active and healthy. The scoped [health-vitals-overlay.Dockerfile](./health-vitals-overlay.Dockerfile) builds on `health-vitals-20260916c` and overlays the user timeline/profile response plus the own activity-entry response, workout reconciliation types, validation and persistence. Watch-derived exact timing, distance and duration are removed from another viewer's profile/timeline response by default. The explicit per-workout share choice is stored in the existing reconciliation JSON, so this deployment needs no schema migration or generated Prisma client replacement.

The reconciliation preview now returns the linked tracking.so activity title, emoji, measure and quantity so the native vitals screen remains anchored to the activity log. Prepared context: `/root/workspace/tracking.so/deployment/tracking-health-vitals-deploy/`. The active pre-deployment environment backup is `deployment/.env.before-health-vitals-20260916c`. Verification confirmed the image and container are healthy, public `/health` returns 200, authenticated Health/timeline routes reject unauthenticated requests with 401, and APNs initializes.

Repeatable build and activation:

```sh
cd /root/workspace/tracking.so/deployment
docker build \
  --build-arg BASE_IMAGE=local/tracking-so-backend:health-vitals-20260916c \
  -f tracking-health-vitals-deploy/hetzner/health-vitals-overlay.Dockerfile \
  -t local/tracking-so-backend:health-vitals-20260916d \
  tracking-health-vitals-deploy
cp -p .env .env.before-health-vitals-20260916d
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:health-vitals-20260916d|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
curl --fail --silent https://api.tracking.so/health
```

Rollback by restoring `.env.before-health-vitals-20260916d` to `.env`, preserving mode 600, recreating only `backend`, and checking `/health`.


## Offline logging, workout graphs and photo notifications — September 23, 2026

Feature commit `4320328d2ad47bcdffdc1a276a6627f5119f92bf` is on main. Production runs `local/tracking-so-backend:four-features-4320328d` (image `ecb7eee4d8fe`), built with [four-features-overlay.Dockerfile](./four-features-overlay.Dockerfile) on the previously active `local/tracking-so-backend:notification-navigation-b156`. This preserves other deployed backend work, including AI SDK 7, notification destinations and workout privacy. The legacy GitHub Actions deployment points to an obsolete directory; this release was manually activated in `/root/workspace/tracking.so/deployment`, and its commit uses `[skip ci]` to prevent a conflicting legacy deployment.

The prepared server context is `tracking-four-features-4320328d/` within that directory. It contains the exact Dockerfile/source and SHA-256 manifest. A private pre-migration database dump and deployment environment backup are in its `backup/` directory; do not commit or print those files. The build regenerated the Prisma client. Exactly these pending migrations were applied successfully to `tracking_cutover`:

- `20260923010000_add_notification_dedupe_key`
- `20260923090000_activity_log_requests`
- `20260923091000_activity_photo_notification_outbox`
- `20260923092000_photo_outbox_per_upload`

Deployment commands on the server, after preparing the source context:

```sh
cd /root/workspace/tracking.so/deployment
docker build -t local/tracking-so-backend:four-features-4320328d tracking-four-features-4320328d
umask 077
mkdir -p tracking-four-features-4320328d/backup
docker exec platform-postgres pg_dump -U postgres -d tracking_cutover -Fc > tracking-four-features-4320328d/backup/database-before.dump
cp .env tracking-four-features-4320328d/backup/deployment.env
BACKEND_IMAGE=local/tracking-so-backend:four-features-4320328d docker compose run --rm --no-deps -T backend pnpm --dir /app/packages/prisma exec prisma migrate deploy
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:four-features-4320328d|' .env
BACKEND_IMAGE=local/tracking-so-backend:four-features-4320328d docker compose up -d --no-deps --force-recreate backend
docker inspect tsw-backend --format '{{.Config.Image}} {{.State.Health.Status}}'
curl -fsS https://api.tracking.so/health
```

The new container became healthy and public `/health` returned `{"status":"ok"}`. Running activity route, durable photo outbox and schema SHA-256 values matched the committed source. No production test entries, media or pushes were created. Isolated PostgreSQL route/delivery checks and native simulator evidence are recorded in the frontend build document. The native release is verified/hosted build 159.

Rollback keeps the additive schema and restores the previous application image:

```sh
cd /root/workspace/tracking.so/deployment
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:notification-navigation-b156|' .env
BACKEND_IMAGE=local/tracking-so-backend:notification-navigation-b156 docker compose up -d --no-deps --force-recreate backend
curl -fsS https://api.tracking.so/health
```

## Coach roles + Garmin webhook-only — active since September 24, 2026 18:47 UTC

Image `local/tracking-so-backend:coach-garmin-20260924` is **built on the server** from [coach-garmin-overlay.Dockerfile](./coach-garmin-overlay.Dockerfile), layered on the active `four-features-4320328d`. Context: `/root/workspace/tracking.so/deployment/tracking-coach-garmin-20260924/` (38 files, `source-hashes.txt` verified). Each file was three-way merged onto the source copied from the running container, so live-only changes are preserved. The typecheck inside the image reports the same 30 pre-existing errors as the active image, none in the changed files.

It adds the coach plan monitoring (hourly job, `SCHEDULED_COACH_MODEL` defaulting to DeepSeek v4.1 Flash at low reasoning) and makes Garmin webhook-only: the 15-minute pull job is removed, the webhook accepts 100 MB and skips the rate limiter, OAuth2 PKCE sits behind `GARMIN_OAUTH_VERSION=2`, and a webhook foreign-key bug that dropped every pushed workout is fixed. One additive migration: `20260924190000_garmin_oauth2`.

Activated with explicit owner approval. A pre-migration dump (3.9 MB) and the previous `.env` are in `$D/backup/`. `prisma migrate deploy` applied `20260924190000_garmin_oauth2`; the container reported healthy, `/health` returned ok, protected routes returned 401, and the Garmin webhook answered 200. The scheduler starts 5 tasks (the Garmin pull job is gone). In Garmin API tools, "User Permissions Change" was enabled to the same webhook; all other enabled summary types already pushed to `https://api.tracking.so/health/garmin/webhook`.

Commands used:

```sh
cd /root/workspace/tracking.so/deployment
D=tracking-coach-garmin-20260924; I=local/tracking-so-backend:coach-garmin-20260924
umask 077; mkdir -p $D/backup
docker exec platform-postgres pg_dump -U postgres -d tracking_cutover -Fc > $D/backup/database-before.dump
cp .env $D/backup/deployment.env
BACKEND_IMAGE=$I docker compose run --rm --no-deps -T backend pnpm --dir /app/packages/prisma exec prisma migrate deploy
sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=$I|" .env
docker compose up -d backend
curl -fsS https://api.tracking.so/health
```

Rollback: restore `$D/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`. The migration is additive and can stay.

## PATCH /users/user field guard — active since September 25, 2026

Production runs `local/tracking-so-backend:user-update-guard-20260925`, built from [user-update-guard-overlay.Dockerfile](./user-update-guard-overlay.Dockerfile) on `streak-20260925` (2 files, hashes in `tracking-user-update-guard-20260925/source-hashes.txt`). No migration. Same 30 pre-existing typecheck errors, none in the changed files. Healthy after the switch; `/health` ok and an unauthenticated `PATCH /users/user` returns 401.

Security fix: the route copied the whole request body into `prisma.user.update`, so any signed-in client could set `planType`, email, Stripe IDs or nested relation writes. `userSelfUpdate` now drops protected, array and object fields (except `reactionEmojis` and `onboardingProgress`).

Rollback: restore `tracking-user-update-guard-20260925/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`.

## Streaks without a grace week — active since September 25, 2026

Image `local/tracking-so-backend:streak-20260925` from [streak-overlay.Dockerfile](./streak-overlay.Dockerfile) on `plan-nudges-20260925` (3 files; the live copies matched git, so the merge was clean). No migration. Same 30 pre-existing typecheck errors. Every missed week now costs one week of streak (no one-week buffer), `achievement.missedLastWeek` records what last week cost, and cached progress from an earlier week is recomputed. Rollback: `tracking-streak-20260925/backup/deployment.env`.

## Plan state + silent coach nudges — active since September 25, 2026 01:02 UTC

Production runs `local/tracking-so-backend:plan-nudges-20260925`, built from [plan-nudges-overlay.Dockerfile](./plan-nudges-overlay.Dockerfile) on `coach-garmin-20260924` with 12 files (hashes in `tracking-plan-nudges-20260925/source-hashes.txt`). No migration. The typecheck inside the image shows the same 30 pre-existing errors as the previous image; `@tsw/prisma/follow-through/pace` resolves and the coach model loads inside the image. After the switch the container was healthy, `/health` returned ok, and the new `POST /follow-through/nudges/:messageId` returned 401 without auth.

It adds the shared `planPace` rule, a silent `nudge` decision for slipping coached plans (message only, no notification or push, once a week per plan), `answerNudge` (remind tomorrow / archive), and one-off reminder pushes delivered by the hourly coach job.

Rollback: restore `tracking-plan-nudges-20260925/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`.
