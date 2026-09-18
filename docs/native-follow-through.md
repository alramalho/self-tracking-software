# Native follow-through release

Status: complete. Local production iPhone build 22 is signed, verified and hosted September 15, 2026; backend deployed and healthy. See frontend BUILDING.md for artifact, installation metadata, expiry and exact checks. Build 21 was intentionally interrupted and never published.

Build 23 supersedes flexible-session and weekly-review behavior below: see [the weekly/profile correction notes](native-weekly-profile-polish.md). The current production image and rollback are documented there.

## Agreed scope

- Preserve Home's metric and plan squares. A minimal coach square opens one explicit check; Up next is a compact square opening the next sessions.
- Plans has This week / Plans. This week aggregates timed, day-only and flexible commitments. Existing plan detail/selector remains; notes collapse, and coach overview moves before Plan group.
- Add and its photo/difficulty/metric follow-ups retain their existing behavior.
- Sessions support starting a timer, opening a user-saved external resource, explicitly confirming activity completion, moving one occurrence, and skipping. Opening resources/timer expiry never claims activity completion.
- Reminders/check-ins require independent consent. Missing logs are unconfirmed. One follow-up per occurrence; after two unanswered delivered checks, coaching outreach pauses across plans. Explicit reminders remain independent. Rescheduling never adds target debt. No automatic acceptance of coach schedule proposals for this flow.
- Revised onboarding asks one input per screen. Free tracking bypasses coaching; later trial choice must use real entitlement/payment configuration. Save coaching answers for later. External courses remain external, and AI may choose only supported activity formats. Gateway-only AI calls.
- Calendar support must name its actual connection/permission and keep events consistent on changes. Never claim a course/calendar/watch integration that is not present.
- Optional small circles: explicit membership/visibility, selected log sharing, no public absence/failure inference. No synthetic members in production.
- Fix Habit -> Lifestyle stage, circular progress, orange flame/green weekly completion, nine streak circles plus overflow.
- Restore Settings drawer layout and add a non-destructive onboarding preview. Preview cannot change entitlement, create a plan, or send notifications. True signup/purchase testing uses a separate test account.

## Release gates

Backend storage and ownership tests, timezone/DST and notification deduplication tests, onboarding free/coach/preview/resume tests, timer/logging and week-view E2E, dark/light native checks, verified production backend deployment if required, followed by local signed iPhone build and hosted-download verification. Follow BUILDING.md. No cloud quota or OTA publication.

## Product constraints

An all-round specialist curriculum generator or live-vitals watch coach was discussed as a separate specialist investment, not promised by these screens. Calendar visibility, reminders, check-ins, and real people are distinct from proof of habit formation. Group efficacy and paid value remain product hypotheses.

App Review: onboarding preview is labelled and documented, never a hidden entitlement bypass. At submission, supply review access and explain non-obvious account-specific features (Apple App Review Guidelines 2.1 and 2.3.1).


## Implementation and experience

Settings → Preview onboarding starts a clean, labelled preview. It uses the real question generator and current trial offer but does not write answers, create plans, change billing/entitlements or send reminders. It ends inside the preview. For actual authentication/signup/checkout testing, sign out and use a separate account; do not reset the existing production account.

The regular wizard saves a resumable draft, then creates one owned plan idempotently. Choosing free tracking preserves coaching answers for later. The configured existing offer is a 14-day trial, then €9.99/month; checkout and backend entitlement remain authoritative. Tests did not start subscriptions. Existing advanced plan creation remains available.

Sessions use real activity logs. Finishing a timer or opening an external lesson does not mark a session done. A matching unambiguous log can reconcile a session; ambiguous logs require selection. Plan-specific answers, next step, resource and actual sessions feed the existing coach conversation. No specialist curriculum, external lesson availability, watch/vitals coaching or demonstrated outcome improvement is claimed.

Reminders and coaching check-ins have separate opt-ins. Coaching delivery uses durable per-occurrence claims, at most one coach check per 24 hours across plans, and pauses after two delivered checks remain unanswered for at least 24 hours. Failed/undelivered pushes do not count as ignored. The old generic proactive coach is disabled when the new flow is configured.

Calendar connection selects a writable calendar exposed by iOS (including Google accounts already added to iPhone Calendar). Sync is app-to-calendar when the week view is opened/updated, with explicit Sync now. Timed sessions export times, day-only sessions are all-day, flexible targets require choosing a slot. Only this account's app-created events are updated/removed. Disconnect leaves existing events. This is not a server-side Google Calendar OAuth connection or a background two-way sync.

Circles have opt-in discovery or private invite links, a 12-member cap, one owned plan per membership and explicit sharing of a real activity. Shared posts omit photos, private notes and location. Leaving removes circle shares while preserving actual activity history. Store submission remains separate; public UGC moderation/report/block requirements must be addressed before submitting this new feature to the App Store.

## Validation, September 15

- Backend and native TypeScript checks passed. Backend model/regression tests: 17 passed; native model tests: 9 passed.
- 33 distinct browser E2E scenarios passed across the full run and targeted final reruns: onboarding/resume/free/preview, week/timer, plan links, chat, logging, follow-ups, photos, comments, reactions and polish. Final reruns correct selectors for retained hidden navigation screens and wait for the actual read-receipt request.
- Actual isolated PostgreSQL 18 schema plus both new SQL migrations passed concurrency, ownership, entitlement, idempotency, timer/outcome, calendar and circle capacity/privacy checks. Explicit row locks use Read Committed to avoid unrelated user serialization failures. No production accounts were created by these tests.
- Native calendar persistence also passed: a future 20-minute session exists exactly once in the actual simulator Calendar database, and the skipped session is absent. Selection/permission and connected-state captures were inspected; this does not claim a physical Google account sync test. Log: /tmp/tracking-sessions-calendar-persistence.log.
- Six real Vercel AI Gateway calls covered guitar with Pickup Music, half-marathon with strength training, and meditation. First question and final synthesis validated the supported schema. Model: openai/gpt-5.6-terra. This is a smoke test, not the deferred multi-model benchmark or an expert curriculum evaluation.
- Native iOS 26.5 onboarding/Settings/keyboard/preview and session/week/timer flows passed in DARK and LIGHT. Captures were inspected. Final Back controls are top left. Evidence is under frontend test-results-native-ios: 2026-09-15_103417, 103635, 104053, 104201 and 105430.

From repository root:

```sh
pnpm --filter backend-node exec tsc --noEmit
pnpm --filter backend-node exec vitest run src/services/follow-through/model.test.ts src/services/wrapped/model.test.ts src/services/wrapped/service.test.ts src/services/people/rank.test.ts
pnpm --filter frontend-expo exec tsc --noEmit
TSX_TSCONFIG_PATH=apps/backend-node/tsconfig.json node --import ./apps/frontend-expo/node_modules/tsx/dist/loader.mjs apps/backend-node/scripts/follow-through/check.cjs
```

The database check deliberately accepts only the isolated local test database on port 55432; set up the schema and migrations there first. It must never be pointed at production.

From apps/frontend-expo, native commands use the fixture binary and environment described in BUILDING.md:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app E2E_THEME=DARK node e2e/native/run.cjs --ios --onboarding
```

Repeat with LIGHT and with --sessions. The simulator binary includes expo-calendar/expo-clipboard and is never distributed. Keep release builds separate from fixture Metro processes.

## Production deployment and rollback

Deployed image: local/tracking-so-backend:follow-through-20260915, image ID sha256:570bad140684f525f6f6c28c1c3da11e05bd261ad8b3296c6c464301dd12132c. It layers the scoped source changes over local/tracking-so-backend:wrapped-2025-search-20260914, preserving the previous annual totals and search deployment. The scoped Docker build context is /tmp/tracking-follow-through-release on the server; Dockerfile copies the new services/routes/types/migrations and the narrowly changed index, cron, coach agent, coach settings and Prisma schema/package before generating Prisma Client.

Migrations applied: 20260915095000_coaching_state and 20260915105000_practice_circles. Before applying, Prisma reported the existing 76 migrations current and only these two pending. Health is HTTP 200 and both new authenticated route groups reject unauthenticated requests with 401.

Connect with the existing identity:

```sh
ssh -i ~/.ssh/hetzner_ed25519 root@89.167.84.67
cd /root/workspace/tracking.so/deployment
docker build -t local/tracking-so-backend:follow-through-20260915 /tmp/tracking-follow-through-release
BACKEND_IMAGE=local/tracking-so-backend:follow-through-20260915 docker compose -f docker-compose.yml -f docker-compose.localdb.yml run --rm --no-deps backend pnpm --dir /app/packages/prisma exec prisma migrate deploy
BACKEND_IMAGE=local/tracking-so-backend:follow-through-20260915 docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d --no-deps backend
docker inspect tsw-backend --format '{{.Config.Image}} {{.State.Health.Status}}'
curl -fsS https://api.tracking.so/health
```

The deployment .env BACKEND_IMAGE is already persisted to the new tag. Rollback uses the prior image in the same up command and restores that one .env setting. Keep the additive tables/migrations; never drop user data during rollback. Prior image information is saved in /tmp/tracking-follow-through-release/previous-image.txt and previous-image-setting.txt on the server. Deployment, migration, Gateway and build logs are in /tmp/tracking-follow-through-* (no secrets should be copied into tracked documentation).

Source remains uncommitted in this workspace. Include these scoped changes AND the prior wrapped/people changes in the next normal source deployment; otherwise an older checkout can undo the deployed behavior. No PWA deployment or store submission was performed.
