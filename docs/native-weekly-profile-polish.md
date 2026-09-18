# Weekly tracking and profile parity corrections

Status: complete. Local production build 23 is signed, verified and hosted; backend corrections deployed and healthy September 15, 2026. See frontend BUILDING.md for exact artifacts, installer metadata, expiry and verification commands. Physical installation remains for the user to confirm.

## User decision

A flexible target such as four exercise days a week is ordinary activity tracking. The person logs whenever they want. It must not require creating a session, choosing a slot, declaring partial completion, skipping or moving an occurrence. Scheduling tools belong to plans whose days/times are actually scheduled.

- Plans selects the first visible plan by default and retains an explicit selection across tab switches. Progress uses full-width 8-point pills; beyond nine, the final slot is a plus. Home retains its compact circles and exact streak overflow.
- This week groups scheduled sessions into one list with separators; only the selected date has a background. Flexible targets are compact progress rows that open the original activity logger (or the existing activity picker for a multi-activity plan). Calendar/circles are behind Week options; per-plan preferences are not repeated here.
- Flexible-only accounts see no date picker, fake Up next card or empty coach card. Legacy flexible session URLs redirect to ordinary logging without posting a session mutation.
- Scheduled sessions retain timer/resource/logging capabilities. Logging is primary; partial completion, skip, move and preferences are under More options. Redundant Back to this week appears only after a recorded outcome.
- Flexible onboarding omits session-tool/reminder/missing-session questions. Scheduled onboarding retains them. Explicit weekly review consent remains optional.

## Backend changes deployed for this release

The follow-through service rejects session creation for unscheduled weekly plans. Calendar export excludes their legacy session records. Reconciliation stops obsolete running timers while preserving elapsed time and recorded outcomes; it never invents activity completion. Coach context and delivery exclude these invented sessions. Old flexible-session checks cannot cause new outreach or count toward the silence threshold.

Agreed weekly reviews summarize the previous complete Sunday–Saturday week in the plan's timezone, with actual distinct logged days. They do not infer failure from absent logs, ask for slots or review a partial week before support was enabled. Completed goals get a concise completion acknowledgement at the agreed weekly review time. **No new immediate completion push, reminder consent, or recurring reminder schedule was inferred or enabled.** Scheduled reminders retain their existing explicit consent rules.

Backend files are under services/follow-through: model.ts, service.ts, calendar.ts, coach-context.ts and types.ts. No database schema change is needed. Production now uses local/tracking-so-backend:weekly-profile-20260915, layered over the build-22 image to preserve prior follow-through/Wrapped/people changes.

## Profile reference and rendering

Compared against frontend-vite ProfilePlanCard.tsx, PlanActivityEntriesRenderer.tsx, BaseHeatmapRenderer.tsx and ui/shine-border.tsx, plus the user's September 15 screenshots.

Profile cards have a soft achievement gradient and a ten-second moving SVG border glimmer. Reduce Motion uses a static border. The radial gradient's focal point moves with its center to avoid clipped highlights on native SVG. The profile heatmap uses 20-point cells with 2-point gaps, omits the full date-range/Today toolbar, keeps horizontal history scrolling and has a compact current-week arrow. Completed weeks use the fire emoji. Achievement labels use the matching outline medal/sprout icons. Plans detail retains its separate toolbar and grid behavior.

## Validation

- Frontend/backend TypeScript passed. Backend follow-through model tests cover no flexible session outreach, completed-calendar-week boundaries, consent/effective date and retiring obsolete timers without completion. Native grid/onboarding/streak models: 19 passed.
- Actual isolated PostgreSQL checks passed, including rejecting flexible session creation and excluding legacy flexible sessions from calendar export, alongside the existing ownership, concurrency, timers, logs and circle privacy cases. No production user-data writes occurred in tests.
- Fifteen distinct browser scenarios passed across the final suite and targeted reruns. The older profile test expected retired badge-drawer copy; it now verifies the current streak explorer and its actual close control. Scheduled timer test also checks navigation through Home after reloading a directly opened session.
- Native flexible-only flows passed DARK (2026-09-15_114230) and LIGHT (114301): quiet Home, compact week, original logger and legacy-link redirect, with zero session mutations.
- Native profile flows passed DARK (113846) and LIGHT (114015), with inspected compact grids, fire markers, legend and changing glimmer frames. A final DARK run checks the radial focal-point correction. Scheduled timer/outcome/calendar persistence also passed after collapsing optional controls.
- Logs: /tmp/tracking-flexible-profile-browser.log, tracking-profile-browser-recheck.log, tracking-scheduled-browser-recheck.log, tracking-weekly-final-unit.log, tracking-flexible-native-unit.log, tracking-flexible-postgres.log, tracking-flexible-native-DARK.log, tracking-flexible-native-LIGHT.log, tracking-profile-grid-native-dark-final.log, tracking-profile-grid-native-light.log, tracking-profile-glimmer-final.log, tracking-scheduled-simplified-native.log.

From apps/frontend-expo, using the fixture binary documented in BUILDING.md:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app E2E_THEME=DARK node e2e/native/run.cjs --ios --flexible
```

Repeat with LIGHT and with --profile-grid; --sessions checks scheduled actions/calendar persistence. Fixture binaries and screenshots are not releases. Follow BUILDING.md to compile, verify, host and deliver a fresh production IPA when requested.

## Production deployment, September 15

Image: `local/tracking-so-backend:weekly-profile-20260915`, ID `sha256:406d07758fa89389b02d5b5855afbae8c38becb9f9c5f0010ca264118a049823`. Only the five files listed above were copied over `local/tracking-so-backend:follow-through-20260915`. Their deployed SHA-256 hashes match validated local source. No migrations were needed. Health returned 200; follow-through/circles retained unauthenticated 401 responses. Backend TypeScript and all 21 follow-through/Wrapped/search regression tests passed.

Scoped context and rollback records are `/tmp/tracking-weekly-profile-release` on the server. Deployment `.env` now persists the new image. Commands:

```sh
ssh -i ~/.ssh/hetzner_ed25519 root@89.167.84.67
docker build -t local/tracking-so-backend:weekly-profile-20260915 /tmp/tracking-weekly-profile-release
cd /root/workspace/tracking.so/deployment
BACKEND_IMAGE=local/tracking-so-backend:weekly-profile-20260915 docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d --no-deps --wait --wait-timeout 90 backend
docker inspect tsw-backend --format '{{.Config.Image}} {{.Image}} {{.State.Health.Status}}'
curl -fsS https://api.tracking.so/health
```

Rollback uses `local/tracking-so-backend:follow-through-20260915` in the same compose command and restores that image in `.env`; no data/table rollback. Source remains uncommitted and must be retained in the next source deployment. Logs are `/tmp/tracking-weekly-profile-backend-{build,deploy,verified}.log` locally.
