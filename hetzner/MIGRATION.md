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

## Streak calendar and profile owner — active since September 30, 2026

Production runs `local/tracking-so-backend:streak-calendar-20260930` (image ID `e902cd33773f825a63b370dad37a1014b94e722c037b580037a441637973038b`), built from [streak-calendar-overlay.Dockerfile](./streak-calendar-overlay.Dockerfile) on `circle-coach-20260929`. Only `plansService.ts` and the progress types were overlaid; both original files matched `ce821038` before activation. No database migration or client rebuild is required.

Week queries, scoring and cache expiry now use the plan owner's local Sunday boundary, including DST. Batch progress uses each plan's owner rather than the viewer. Cache version 2 records the calculation timezone; incompatible caches recompute before being returned. Existing completed/held/missed rules and archived-plan handling are unchanged.

The 12 calendar regressions passed inside the exact candidate image with networking disabled. Normalized typecheck diagnostics were identical to the previous image. After activation, the container was healthy with zero restarts, public `/health` returned `{"status":"ok"}`, and unauthenticated plan/profile routes returned 401. Live progress recomputed Alex's training plan to 7 and archived Deep Learning plan to 1, with cache version 2 and `Europe/Lisbon`; another viewer received the same values. This does not identify the separate reported Studying entry.

Server context: `/root/workspace/tracking.so/deployment/tracking-streak-calendar-20260930/`. The database dump and previous deployment environment are in its root-only `backup/` directory; `.dockerignore` excludes backups from subsequent builds. Both deployed source hashes match the local fix.

Build, activation and verification commands (on the server, with the verified source already staged):

```sh
cd /root/workspace/tracking.so/deployment
D=tracking-streak-calendar-20260930
docker build --network=none \
  --build-arg BASE_IMAGE=local/tracking-so-backend:circle-coach-20260929 \
  -f "$D/hetzner/streak-calendar-overlay.Dockerfile" \
  -t local/tracking-so-backend:streak-calendar-20260930 "$D"
docker run --rm --network none --env-file .env --env-file database-local.env \
  -v "$PWD/$D/apps/backend-node/src/services/__tests__/plansService.calendar.test.ts:/app/apps/backend-node/src/services/__tests__/plansService.calendar.test.ts:ro" \
  local/tracking-so-backend:streak-calendar-20260930 \
  node_modules/.bin/vitest run src/services/__tests__/plansService.calendar.test.ts
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=local/tracking-so-backend:streak-calendar-20260930|' .env
docker compose up -d --no-deps backend
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
curl --fail --silent https://api.tracking.so/health
docker exec tsw-backend sha256sum /app/apps/backend-node/src/services/plansService.ts /app/packages/prisma/types/index.ts
```

Rollback is saved and syntax-checked as `tracking-streak-calendar-20260930/rollback.sh`. It refuses to overwrite a later release, restores `backup/deployment.env` with mode 600, recreates only the backend, invalidates caches written by version 2 so the old rules recompute, and retries public health. Run it only while this release is active:

```sh
cd /root/workspace/tracking.so/deployment
./tracking-streak-calendar-20260930/rollback.sh
```

## Circle coach posts and 2-person boards — active since September 29, 2026

Image `local/tracking-so-backend:circle-coach-20260929` from [circle-coach-overlay.Dockerfile](./circle-coach-overlay.Dockerfile) on `circle-chat-20260929` (live files matched git `d1ea7857`). No schema change.

- Migration `20260929160000_circles_board_from_two` (data only): circles with 2 proven members became ACTIVE; the 1 existing circle ("train 4 times a week") is now ACTIVE. Dump: `tracking-circle-coach-20260929/backup/database-before.dump`, env: `tracking-circle-coach-20260929/backup/deployment.env`.
- The board starts at 2 proven people. The hourly circle job now has Helly post in each ACTIVE circle's chat (Sunday 19:00 recap, Thursday 18:00 halfway check when someone is behind, owner's time zone), once per circle and week, with a push to members; this replaces the per-person Sunday recap push.
- Checks: modules loaded with the production env and no network; healthy after activation, `/health` ok.

Rollback: restore `tracking-circle-coach-20260929/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`.

## Circle chat — active since September 29, 2026

Image `local/tracking-so-backend:circle-chat-20260929` from [circle-chat-overlay.Dockerfile](./circle-chat-overlay.Dockerfile) on `circle-proof-20260929` (live files matched git `fdfc4742`, including `routes/chats.ts`).

- Migration `20260929150000_circle_chat` (additive: `chats.circleId`, unique, cascades with the circle). Dump: `tracking-circle-chat-20260929/backup/database-before.dump`, env: `tracking-circle-chat-20260929/backup/deployment.env`.
- `POST /circles/:id/chat` opens the circle's group chat for proven members; participants follow proven membership. Group message pushes skip blocked pairs and name the circle.
- Checks: modules loaded with the production env and no network; after activation healthy, `/health` ok, `/circles/:id/chat` and `/chats` 401 unauthenticated.

Rollback: restore `tracking-circle-chat-20260929/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`. The migration is additive and can stay.

## Circle photo proof — active since September 29, 2026

Image `local/tracking-so-backend:circle-proof-20260929` from [circle-proof-overlay.Dockerfile](./circle-proof-overlay.Dockerfile) on `circles-20260929` (13 circle source files, schema and migration; no new packages).

- Migration `20260929120000_circle_proof` (additive: `circle_members.provenAt/proofNudgedAt`, `circle_events`, enum `CircleEventKind`). It marked the 2 existing members as proven and opened the 1 existing circle. Dump: `tracking-circle-proof-20260929/backup/database-before.dump`, env: `tracking-circle-proof-20260929/backup/deployment.env`.
- Joining is pending until the first photo log on the circle plan; the hourly circle job now also sends the coach's proof reminder after a day and frees pending spots after a week.
- Checks: modules loaded in the image with the production env and no network; after activation the container is healthy, `/health` ok, circle routes 401 unauthenticated, scheduler 6 tasks.

Rollback: restore `tracking-circle-proof-20260929/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`. The migration is additive and can stay.

## Circles — active since September 29, 2026

Image `local/tracking-so-backend:circles-20260929` from [circles-overlay.Dockerfile](./circles-overlay.Dockerfile) on `streak-hold-20260928` (every overlaid file matched git `520d8fcd` in the live container before the build; only `package.json` differed, and it isn't copied). `sharp@0.34.5` is installed on its own with npm (Alpine musl build) for the blurred circle photo previews, like the Apple library.

- Migration `20260929090000_circles` (additive: `circles`, `circle_members`, `circle_nudges`, enums `CircleStatus`/`CircleRole`, `NotificationType.CIRCLE`, `users.approxLatitude/approxLongitude/approxPlace`, `activity_entries.imagePreview`). Its backfill turned the 1 plan group with 2 active members into 1 forming circle; there were no practice circles. Dump: `tracking-circles-20260929/backup/database-before.dump` (3.9 MB), env: `tracking-circles-20260929/backup/deployment.env`.
- Before activation, the changed routes and the scheduler loaded in the image with the production env and no network. After activation: healthy container, `/health` ok, `/circles/mine`, `/circles/suggestions` and `/users/timeline` return 401 unauthenticated, scheduler starts 6 tasks (the hourly circle job is new).
- See [docs/circles.md](../docs/circles.md) for the product rules.

Rollback: restore `tracking-circles-20260929/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`. The migration is additive and can stay.

## Streak "one short holds" + full grid history on profiles — active since September 28, 2026

Image `local/tracking-so-backend:streak-hold-20260928` from [streak-hold-overlay.Dockerfile](./streak-hold-overlay.Dockerfile) on `apple-iap-20260927` (3 files; live matched git `877c8cb1`). No migration. Same 30 pre-existing typecheck errors.

- A past week one session short of a target of 3+ holds the streak (never two weeks in a row); weeks carry `outcome` complete / held / missed.
- `POST /users/get-user` also returns `gridEntries` (id, activityId, datetime, quantity; up to 3000) so other people's plan grids show full history.
- All plan progress caches were invalidated (`UPDATE public.plans SET "progressCalculatedAt" = NULL`, 100 rows) so streaks recompute under the new rule. Dump: `tracking-streak-hold-20260928/backup/database-before.dump`.

Rollback: restore `tracking-streak-hold-20260928/backup/deployment.env` to `.env` and `docker compose up -d backend`, then invalidate caches again.

## Apple in-app subscriptions — active since September 27, 2026

Image `local/tracking-so-backend:apple-iap-20260927` from [apple-iap-overlay.Dockerfile](./apple-iap-overlay.Dockerfile) on `coaching-plans-20260926` (live copies matched git `68c9a971`). The image's workspace lockfile can't run `pnpm add`, so `@apple/app-store-server-library@3.1.0` is installed with npm in a temp folder and copied into `apps/backend-node/node_modules` (only packages not already present). Same 30 pre-existing typecheck errors.

- Migration `20260927100000_user_apple_subscription` (additive: `users.appleAppAccountToken`, `appleOriginalTransactionId` (both unique), `appleProductId`, `appleSubscriptionExpiresAt`, `appleSubscriptionStatus`). Dump: `tracking-apple-iap-20260927/backup/database-before.dump`.
- Routes `/billing/apple/{account-token,transactions,notifications}`; Apple root certificates ship in `apps/backend-node/certs/apple/`.
- App Store Server Notifications V2 URL set (Production + Sandbox) to `https://api.tracking.so/billing/apple/notifications`; a Sandbox TEST notification was received and verified on September 27.

Rollback: restore `tracking-apple-iap-20260927/backup/deployment.env` to `.env` and `docker compose up -d backend`. The migration is additive.

## Coaching plans: quarterly, monthly, weekly — active since September 26, 2026

Image `local/tracking-so-backend:coaching-plans-20260926` from [coaching-plans-overlay.Dockerfile](./coaching-plans-overlay.Dockerfile) on `ai-consent-20260925` (1 file, `billing.ts`; live matched git). `/follow-through/onboarding/offer` returns `plans` read live from Stripe, with the first plan also at the top level for older builds.

- New `.env` key `COACHING_PAYMENT_LINKS=quarterly=plink_1UJsJ3G1Uxsr0eW4iXBX3uQl,monthly=plink_1UJsJ4G1Uxsr0eW4THI2QsOT,weekly=plink_1UJsJ5G1Uxsr0eW43FShK0IQ`.
- Stripe (live, product `prod_Rrxwn49xYONdj6` "tracking.software Plus", so the existing webhook grants PLUS): new prices €3.99/week `price_1UJsIiG1Uxsr0eW4QHOsbZL1` and €19.99/3 months `price_1UJsIkG1Uxsr0eW4libEoH1e`; monthly reuses €9.99 `price_1SeCvRG1Uxsr0eW4kSBmOWYz`. Links copy the old link's settings (automatic tax, billing address auto); 7-day trial on quarterly and monthly, none on weekly.
- The old €9.99 / 14-day link `plink_1SeCxKG1Uxsr0eW48xMnLmee` is deactivated (reactivate in Stripe if needed; existing subscriptions are unaffected).
- Verified inside the running container: the offer returns quarterly 1999 (7 days), monthly 999 (7 days), weekly 399.

Rollback: restore `tracking-coaching-plans-20260926/backup/deployment.env` to `.env` and `docker compose up -d backend`, and reactivate the old link.

## AI consent (inactive) + Braintrust removed — active since September 25, 2026

Image `local/tracking-so-backend:ai-consent-20260925` from [ai-consent-overlay.Dockerfile](./ai-consent-overlay.Dockerfile) on `app-store-safety-20260925` (25 files; all live copies matched git `942f6078` except `apps/backend-node/package.json`, whose live `zod ^4.0.0` pin was kept by the three-way merge). Same 30 pre-existing typecheck errors. Healthy; `/health` ok; `PUT /users/ai-consent` returns 401 without auth; no Braintrust process runs (the `start` script no longer imports `braintrust/hook.mjs`, and `wrapAISDK`, `initLogger` and `traced()` are gone).

- Migration `20260925180000_user_ai_consent` (additive: `users.aiConsentGrantedAt`, `users.aiConsentDeclinedAt`). Dump: `tracking-ai-consent-20260925/backup/database-before.dump`.
- Consent is **not enforced**: `AI_CONSENT_ENFORCED` is unset, so every existing build keeps working. Set `AI_CONSENT_ENFORCED=true` when the App Store build that asks for consent is released; AI routes then return 403 `AI_CONSENT_REQUIRED` and background AI jobs skip people who haven't allowed it.
- `BRAINTRUST_API_KEY` in `.env` is now unused.

Rollback: restore `tracking-ai-consent-20260925/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`.

## App Store safety: reports, blocks, suspension, deletion, Garmin gate — active since September 25, 2026

Image `local/tracking-so-backend:app-store-safety-20260925` from [app-store-safety-overlay.Dockerfile](./app-store-safety-overlay.Dockerfile) on `user-update-guard-20260925` (21 files; every live copy matched git `12bf935c`, so the three-way merges were clean; `prisma generate` runs in the image). Same 30 pre-existing typecheck errors, none in the changed files. Healthy after the switch; `/health` ok; `/moderation/*` and `/admin/reports` return 401 without auth.

- Migrations applied with `prisma migrate deploy`: `20260925120000_content_reports_and_user_blocks`, `20260925130000_user_suspension` (both additive). Pre-migration dump: `tracking-app-store-safety-20260925/backup/database-before.dump` (3.9 MB).
- New `.env` keys: `REPORT_BCC_EMAILS` (copy of every report email) and `GARMIN_TESTER_EMAILS` (who sees Garmin while the key is in evaluation; set `GARMIN_OPEN_TO_ALL=true` after approval). Report emails go to `ADMIN_EMAIL`.
- Moderation: `GET /admin/reports`, `POST /admin/reports/:id/resolve {"action":"dismiss"|"remove"|"suspend"}`, `POST /admin/users/:id/suspend|unsuspend` (Bearer `ADMIN_API_KEY`).
- Account deletion: billing, then Clerk, then data, then S3 media; failures before the data step delete nothing.

Rollback: restore `tracking-app-store-safety-20260925/backup/deployment.env` to `.env` (mode 600) and `docker compose up -d backend`. The migrations are additive and can stay.

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


## Circle encouragement — active since September 30, 2026

Image `local/tracking-so-backend:circle-encouragement-20260930`, built with [circle-encouragement-overlay.Dockerfile](./circle-encouragement-overlay.Dockerfile) on `streak-calendar-20260930`. Only `routes/chats.ts` is overlaid; the previous live file matched the feature baseline. The image preserves the deployed streak/coach changes. No migration or new dependencies.

`POST /chats/direct` accepts optional `circleId` and requires both people to be proven members of that circle to open a private chat without a friend connection. Self/blocked/outsider/pending access remains rejected. Opening a chat does not notify; explicitly posting the personal message uses existing chat notifications. Older clients’ nudge endpoint remains available.

Context and source hashes: `/root/workspace/tracking.so/deployment/tracking-circle-encouragement-20260930/`. Source commit `0022291e`; deployed route SHA-256 `bd21aec23d856338dea5a3b20545f2e89b648333252dc80df95ed189df75ca41`. Before activation, environment/compose and the database (3,920,647 bytes) were backed up. After activation: correct image/source hash, healthy container, public `/health` HTTP 200 and unauthenticated `/chats/direct` HTTP 401. The image typecheck reports the same 30 existing errors, none in the changed route.

Build/verification commands on the server:

```sh
cd /root/workspace/tracking.so/deployment
docker build -f tracking-circle-encouragement-20260930/hetzner/circle-encouragement-overlay.Dockerfile -t local/tracking-so-backend:circle-encouragement-20260930 tracking-circle-encouragement-20260930
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' tsw-backend
docker exec tsw-backend sha256sum /app/apps/backend-node/src/routes/chats.ts
curl --fail --silent https://api.tracking.so/health
```

The context’s `activate.py` backed up before switching `BACKEND_IMAGE`, checked concurrent changes, activated with `docker compose up -d --no-deps backend`, verified public health/source/authentication and automatically restored the previous environment on failure. It is a one-time guarded activation; inspect `verified.json` instead of rerunning it. Rollback:

```sh
cd /root/workspace/tracking.so/deployment
cp tracking-circle-encouragement-20260930/backup/deployment.env .env
chmod 600 .env
docker compose up -d --no-deps backend
curl --fail --silent https://api.tracking.so/health
```

## Plan design (coached outcome plans) — active since October 1, 2026 15:16 UTC

Image `local/tracking-so-backend:plan-design-20261001` (image ID `5872f521d5d3…`), built with [plan-design-overlay.Dockerfile](./plan-design-overlay.Dockerfile) on `circle-encouragement-20260930`. Source commit `a30dc209` (branch `outcome-onboarding`, with main `681c5050` merged in). All 14 existing files that the overlay replaces matched `origin/main` in the live container before the build; 15 files are new. The Prisma client is regenerated in the image. No new dependencies.

- Migration `20261001090000_plan_design` (additive, nullable columns only): `plans.orientation/goalSpec/baseline/outline/designedThrough` and `plan_sessions.title/targets`. It was the only pending migration and was applied with `prisma migrate deploy` from the new image before the switch; the previous backend ignores the new columns.
- New endpoints under `/follow-through`: `POST onboarding/design/classify`, `POST onboarding/design/subgoal`, `POST onboarding/design/options`, `GET onboarding/design/baseline`, `POST plans/:planId/redesign`. Existing onboarding, finish and weekly review paths are unchanged for plans without an orientation, so older app builds keep working.
- Models through the AI Gateway (same production key): Opus 5.5 designs the two routes at onboarding, Sonnet 5.5 extends outcome plans by two weeks at review, each falls back to the other; gpt-6-luna for the short calls. Overrides: `PLAN_DESIGN_MODEL`, `PLAN_ADAPT_MODEL`, `PLAN_QUICK_MODEL`, `PLAN_FALLBACK_MODEL`, `PLAN_DESIGN_EFFORT`. None are set.
- Before activation, in the exact candidate image: all 29 overlaid source hashes matched, the changed routes and services loaded with the production environment and no network, typecheck reported the same 30 existing errors as the previous image, and the 40 plan-design unit tests passed offline. All three models were listed for the production key.
- After activation: healthy container with zero restarts, public `/health` 200, the four new endpoints return 401 unauthenticated, `prisma migrate status` up to date, and one real goal classification inside the live container returned OUTCOME for "Finish my first half marathon" and CONSISTENCY for "Train 4x a week".

Server context: `/root/workspace/tracking.so/deployment/tracking-plan-design-20261001/` (`context/`, `source-hashes.json`, `activate.py`, `verified.json`, `rollback.sh`). `backup/` holds the environment, compose file and a 3.9 MB database dump taken before the migration; `backup-first-attempt/` is an identical earlier backup from a first run that stopped before changing anything (the status check exits 1 while a migration is pending).

Rollback, only while this release is active (the migration is additive and can stay):

```sh
cd /root/workspace/tracking.so/deployment
./tracking-plan-design-20261001/rollback.sh
```

## Account switching — active since October 1, 2026 15:34 UTC

Image `local/tracking-so-backend:account-switch-20261001`, derived from `plan-design-20261001`; the later `circle-momentum-20261001` image is built on it, so it is still live. It lets the native app switch accounts without Clerk multi-session: a device holds a switch token per remembered account and trades it for a 60-second Clerk sign-in ticket. The source reached main on October 2, 2026.

Scope: `routes/auth.ts` gains `POST /auth/switch-tokens` (signed-in), `POST /auth/switch` and `POST /auth/switch-tokens/revoke`; new `services/auth/switchTokenService.ts`; one type in `services/auth/types.ts`; additive migration `20261001160000_add_account_switch_tokens` (new table `account_switch_tokens`, no changes to existing tables). The overlay is [account-switch-overlay.Dockerfile](./account-switch-overlay.Dockerfile). It patches the schema already inside the production image with `account-switch/add-schema-model.cjs` instead of copying a working-tree schema. Before the build, the two replaced files in the live container matched their committed hashes.

Server context: `/root/workspace/tracking.so/deployment/tracking-account-switch-20261001/` with `context/`, `source-hashes.json`, `activate.py`, `rollback.sh`, `verified.json` and `backup/` (the pre-migration dump of `tracking_cutover`, the previous `.env` and compose file). Activation confirmed exactly one pending migration, applied it, switched the image and verified: container healthy with zero restarts, public `/health` 200, `POST /auth/switch-tokens` without sign-in 401, `POST /auth/switch` with an unknown token 401 and without one 400, revoke without a token 400. A pre-flight in the built image loaded the routes module offline.

Not verified: a real switch. No token has been issued or redeemed yet; that needs a signed-in device on a build with the switcher (Safari build 191, TestFlight build 198 onward).

Rollback: `tracking-account-switch-20261001/rollback.sh` refuses while a later release is live. The table can stay; older images ignore it.

## Circle momentum and in-app invites — active since October 1, 2026 20:04 UTC

Image `local/tracking-so-backend:circle-momentum-20261001`, built with [circle-momentum-overlay.Dockerfile](./circle-momentum-overlay.Dockerfile) on `account-switch-20261001` (the account switch release was live but not yet on main, so the overlay keeps it: the image's schema is the live one plus this release's two fields and one enum value). Source: branch `circle-momentum`. The 14 existing files the overlay replaces matched `origin/main` in the live container; `package.json` is not copied (the live copy predates main). New dependency `satori@0.33.5`, installed into the image the same way as sharp.

- Migrations `20261001170000_circle_momentum` (`circles.coachPosts`, `circle_members.muted`, both with defaults) and `20261001180000_circle_invited_event` (enum value `INVITED` on `CircleEventKind`). Both additive; they were the only pending migrations and were applied with `prisma migrate deploy` from the new image before the switch.
- What it adds: `pastWeeks`, `coachPosts` and `me.muted` on the circle board; `weekChip` on circle logs in `/users/timeline` and `/circles/:id/feed`; `PATCH /circles/:id` takes `coachPosts`; `PATCH /circles/:id/membership` (`muted`); `GET /circles/:id/invitable` and `POST /circles/:id/invites`; the Sunday recap gains the photo of the week (as a message image attachment), a "who leads" line and a "never miss twice" ask, and stays quiet when the owner switched it off; public `GET /og/circle-invite/:code` and `/og/circle-invite/:code.png` for link previews. Older app builds keep working: `recap` and `togetherStreak` are still returned.
- Before activation, in the exact candidate image with the production environment and no network: the changed modules loaded, a preview image rendered, the Prisma client had both the account switch model and the new enum value, and typecheck reported the same 30 existing errors as the previous image.
- After activation: healthy container with zero restarts, public `/health` 200, the new circle endpoints return 401 unauthenticated, an unknown invite returns 404 (meta) and a 302 to the default image, `POST /auth/switch` still answers 400, and a real circle's preview returned a 1200×630 PNG with its members' photos.

Server context: `/root/workspace/tracking.so/deployment/tracking-circle-momentum-20261001/` (`source-hashes.txt`, `activate.py`, `verified.json`, `rollback.sh`). `backup/` holds the environment, compose file and a 3.9 MB database dump taken before the migrations.

Rollback, only while this release is active (the migrations are additive and can stay):

```sh
cd /root/workspace/tracking.so/deployment
./tracking-circle-momentum-20261001/rollback.sh
```

## Dictation languages, Whisper and the shared streak rule — active since October 2, 2026 11:26 UTC

Image `local/tracking-so-backend:voice-languages-20261002`, built with [voice-languages-overlay.Dockerfile](./voice-languages-overlay.Dockerfile) on `circle-momentum-20261001`. Source: branch `voice-feedback` (`c71631f0`, on main `539cbb44`). The overlay replaces 12 existing backend and shared files, all of which matched main `539cbb44` in the live container, and adds 2 new ones plus the migration. The live `schema.prisma` differed from main (it still carries the account switch model), so the overlay patches the image's own schema and `packages/prisma/package.json` in place instead of replacing them.

- Migration `20261002120000_spoken_languages` (additive): `users.spokenLanguages` (text array, default empty) and the enum value `TRANSCRIPTION_FEEDBACK` on `FeedbackCategory`. It was the only pending migration and was applied with `prisma migrate deploy` from the new image before the switch.
- Speech to text is now `openai/whisper-large-v3` through OpenRouter (it was `nvidia/parakeet-tdt-0.6b-v3`, which takes no language and misheard a short Portuguese clip as Russian). `STT_MODEL` is not set in the live `.env`, so the code default applies; set it there to override. Startup logs `Speech-to-text configured with OpenRouter (openai/whisper-large-v3)`.
- `POST /ai/transcribe` also returns `language` and `model`, and grounds the model in the person's languages: one language is passed to the model; with several the model detects, and a clip heard in a language the person doesn't speak is transcribed again in their main one. `POST /voice-logs/preview` uses the same languages.
- `POST /ai/transcribe/feedback` stores a thumbs up or down in the shared `feedback` table (the transcript only for a thumbs down). `PATCH /users/user` accepts `spokenLanguages` (up to 5 known ISO 639-1 codes).
- The streak rule lives in `packages/prisma/follow-through/streak.ts`. `missedLastWeek` gains `done`, `target` and `oneShortAgain`; progress cache version is 3, so every plan recomputes on first read. The coach's instructions now state the rule and each plan's streak.
- Older app builds keep working: every response only gains fields.
- Before activation, in the exact candidate image: typecheck reported the same 30 existing errors as the previous image (none in the changed files), and 30 unit cases (streak rule, calendar scoring, languages and feedback parsing, speech-to-text config) passed with networking off. With the production environment, Whisper transcribed a synthetic short Portuguese M4A correctly with no saved language, with `["pt"]` and with `["pt", "en"]`, a longer Portuguese clip and a short English one; with `["en", "es"]` it logged that it heard `pt` and transcribed again in `en`. Requests took 0.3 to 4.9 seconds.
- After activation: healthy container with zero restarts, public `/health` 200, the startup log line above, `/ai/transcribe`, `/ai/transcribe/feedback`, `PATCH /users/user`, `/plans` and `/circles/none` return 401 unauthenticated, and `POST /auth/switch` still answers 400. No signed-in request was made, so a real dictation from the app is not confirmed.

Server context: `/root/workspace/tracking.so/deployment/tracking-voice-languages-20261002/` (`source-hashes.txt`, `activate.py`, `verified.json`, `rollback.sh`). `backup/` holds the environment, compose file and a 3.9 MB database dump taken before the migration.

Rollback, only while this release is active (the migration is additive and can stay; it returns to Parakeet):

```sh
cd /root/workspace/tracking.so/deployment
./tracking-voice-languages-20261002/rollback.sh
```
