# Compact plan assistance

Status: shipped in local production build 26, September 15, 2026. IPA and hosted installer verified; see frontend BUILDING.md for artifact paths and repeatable commands. No backend change or production deployment is required. Build 23 does not contain this UI.

The plan's long Session preferences form is replaced by one grouped set of three icon-led rows: Schedule, Reminders and Weekly review. Each shows its saved value and opens the existing content-sized native drawer, with a strong icon, one question and a short consequence. Plan detail embeds the controls directly below notes. Existing plan-support links open the same compact controls.

Schedule starts with Anytime or Choose days, then a day selector and an optional time. iOS uses its native time wheel. Days are capped at the plan's existing weekly target. Choosing Anytime removes future recurring sessions through the existing backend and explicitly turns off session reminders/check-ins; actual activity logs and weekly-review consent remain intact. Date-specific plans retain their existing calendar rather than gaining a duplicate recurring schedule.

Reminders are independent: timed sessions offer lead times; day-only sessions use an exact reminder time. Flexible plans explain that there is no scheduled occurrence to remind about and offer optional day selection; they never enable reminders implicitly. System notification permission remains necessary, with a link to the existing settings control.

Weekly review is a specific opt-in, with a chosen day/time and the existing coaching entitlement requirement. Enabling it does not enable after-session checks. Disabling it preserves separately agreed session checks. No new notification schedule, push capability or AI behaviour is claimed. The existing backend remains authoritative.

Scheduled session More options retains timer/resource configuration and after-session check controls behind Session tools. Generic next-step text and the vague Use my coach switch are removed from the main preference flow. Existing saved next steps/resources remain unchanged unless explicitly edited.

Unsaved drawer choices are local. Close/backdrop/drag discards them; each Save writes the complete existing support with only the relevant draft changes. Failed saves keep the sheet and selections available for retry. Successful saves refresh the displayed agreement. Existing global notification and coaching silence rules remain unchanged.

## Validation

Frontend TypeScript and four browser E2E scenarios passed. Coverage: main-plan embedding, dark/light appearance, cancel with zero writes, separate schedule/reminder/review saves, error/retry, persistence after reload, switching back to flexible with weekly consent preserved, invalid time rejection, free-account review gating, and retained resource/after-session-check editing. Browser screenshots inspected. Log: `/tmp/tracking-assistance-browser-final.log`.

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/plan-assistance.spec.ts
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app E2E_THEME=DARK node e2e/native/run.cjs --ios --assistance
```

Repeat native with LIGHT. Fixtures never write production activity/preferences. This assistance change adds no native dependencies; a requested release must use a fresh signed local build using BUILDING.md.

### Simulator isolation

The original simulator run could not launch because concurrent Watch work added a required `TrackingWatch` native module that the existing signed fixture binary does not contain. That unrelated source was not changed. UI validation uses a copied frontend at `/private/tmp/tracking-assistance-fixture/apps/frontend-expo`, with its `src/native/watch/bridge.ios.ts` replaced **only in that disposable copy** by the existing no-op `bridge.ts`. Other frontend source is copied unchanged; shared packages/dependencies/backend fixtures are linked to the workspace. This tests the actual assistance UI and API payloads, not Watch transport or release integration. Rebuild the simulator with Watch before claiming complete current-app native coverage.

The native command above ran from that isolated frontend. Dark flow passed at `test-results-native-ios/2026-09-15_141429/assistance-ios`, with three exact independent writes verified against the fixture service and screenshots inspected. Logs: `/tmp/tracking-assistance-native-DARK-isolated.log` and `/tmp/tracking-assistance-native-LIGHT-isolated.log`. An earlier interrupted test-driver run at 141252 is not counted as a pass.

Both DARK and LIGHT isolated native flows passed, with exact persisted schedule/reminder/review values, no unintended check-in opt-in, and three writes after a cancelled draft. Captures are copied into `apps/frontend-expo/test-results-native-ios/assistance-isolated/` for review. These results do not validate the separate Watch integration.

## Combined release verification

The complete DARK native assistance flow also passed against the new combined iPhone/Watch simulator binary, with the real Expo Watch module present (no Watch stub): `test-results-native-ios/2026-09-15_142416/assistance-ios/`. All three independent saves and cancellation were verified against the fixture service. Log: `/tmp/tracking-assistance-combined-native.log`. This confirms the new controls launch and work with the native module; physical Watch synchronization is separate. Combined local production build 26 passed IPA and hosted-download verification, including the new assistance markers and signed Watch companion. Builds 24 and 25 were intentionally interrupted before export to correct Watch version and icon metadata; neither was published. The new installer and full IPA checksum passed in light/dark appearances. Physical installation remains for the user to confirm.
