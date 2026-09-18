# Build on the Mac, install from a link

## Default workflow

The user primarily works from their iPhone. Build native release IPAs on their Mac and give them a Safari installation link. The phone needs neither a cable, the Mac's Wi-Fi, nor a running Metro server. The Mac must be awake and reachable while building/uploading; once hosted, downloads and the installed app run independently of it.

Prefer local EAS builds. Do not silently consume cloud quota, purchase a plan, submit to stores, or publish OTA updates. `build:iphone:cloud` is an explicit alternative when requested. The build workflow does not deploy the backend or Vite/Capacitor. Build 17 also required a separately verified backend change, documented below.

From the repository root:

```sh
pnpm --filter frontend-expo build:iphone:check
AWS_PROFILE=default pnpm --filter frontend-expo build:iphone
```

The second command builds, verifies, uploads and prints an install link using the working AWS CLI `default` profile. It does not read backend secrets. The old backend `.env` AWS key is invalid; do not use it. `IPHONE_STORAGE_ENV_FILE` remains an optional explicit alternative for a valid AWS key pair, but is not needed on this Mac.

To separate compilation from hosting:

```sh
pnpm --filter frontend-expo build:iphone:local
pnpm --filter frontend-expo build:iphone:publish /absolute/path/to/new-build.ipa
```

`build:iphone:package /absolute/path/to/app.ipa` verifies an existing IPA and writes an **offline installer preview** with deliberately invalid URLs. It does not upload or produce an installable link. It must not be described as a fresh release.

Scripts live in `scripts/iphone/`. All generated artifacts, environment config, verification reports and signed links live in ignored `.release/`, also excluded by the repository's `.easignore`. Never commit those outputs.

## One-time setup

1. Install Xcode **26.4 or later** for Expo SDK 57. Set `DEVELOPER_DIR` to its `Contents/Developer` directory. The script selects `/Applications/Xcode.app/Contents/Developer` when the environment points only to Command Line Tools. Complete Xcode's first launch/license/component installation. Also run `xcodebuild -downloadPlatform iOS` for the selected Xcode: a version check alone can pass while the iOS platform remains unavailable to archive builds. Do not patch Expo dependencies to compensate for old Xcode.
2. Have Node, pnpm, CocoaPods, Fastlane, Python 3, OpenSSL and AWS CLI available. Authenticate with EAS CLI 24.0.0. Local EAS builds still contact Expo for project metadata, remote build numbers and managed signing credentials, but consume no cloud build quota.
3. Put the two production public values in `.release/production.env.json` (mode 600). This file was populated on this Mac from the previously verified release environment, so it no longer depends on a temporary file. On another Mac supply `IPHONE_ENV_FILE=/absolute/path/to/file.json` or recreate it from EAS's production environment:

   ```json
   {
     "EXPO_PUBLIC_BACKEND_URL": "https://api.tracking.so",
     "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_REPLACE_WITH_EXISTING_PUBLIC_KEY"
   }
   ```

   Never use the Vite `.env` fallback for a release: it may contain localhost/test Clerk configuration. The wrapper whitelists these two values, disables Expo dotenv loading, removes fixture auth, and verifies the actual IPA values after compilation.
4. Use the private S3 bucket `alramalho-native-builds-854257060653`, region `eu-central-1`, prefix `tracking-so/ios`, created and verified September 13, 2026. All four S3 Public Access Block flags are enabled. The uploader reads the flags before upload and never changes policy. The existing production media bucket was left unchanged. Use `IPHONE_BUCKET`/`IPHONE_REGION` only for a deliberately selected alternative. The working credentials are in AWS CLI profile `default`; `codex-admin` currently needs reauthentication. Credentials need `s3:GetBucketPublicAccessBlock`, `s3:PutObject` and `s3:GetObject` on the chosen bucket/prefix.

The upload creates a unique directory containing the IPA, `manifest.plist` and `index.html`. S3 supplies trusted HTTPS. All three URLs are presigned; default expiry is seven days (`IPHONE_LINK_TTL`, 60–604800 seconds). Temporary AWS credentials can expire earlier. Object expiry is separate: uploaded objects remain until removed or covered by an existing storage lifecycle rule. This uses normal storage/transfer billing, not Expo build credits. No bucket policies or lifecycle rules are modified by the script.

## TestFlight distribution — builds 70 and 78, September 17, 2026

TestFlight uses a separate App Store distribution profile and does not use the Safari-install/ad hoc workflow above. The App Store Connect app is `6754610882`, the iPhone bundle is `so.tracking.app`, and the Watch companion is `so.tracking.app.watchkitapp`.

- **Build 70 is uploaded and processed by Apple** with `processingState: VALID` and `internalState: IN_BETA_TESTING`. It is ready for the existing `internal testers` group; internal groups receive processed builds automatically and cannot be assigned through the external beta-group relationship endpoint.
- Apple’s local validator passed the exact IPA before upload. Delivery UUID: `21a6501e-b1fb-47c8-85b5-fb0132348943`. The build uses the production API/live Clerk configuration, includes the iPhone and Watch targets, and has `usesNonExemptEncryption: false`.
- **Build 78 is the latest verified local production IPA**. Apple’s local validator passed it, Apple processed it as `VALID`, and it was uploaded with delivery UUID `7bb2df28-82d8-4ad0-988a-69f301f01629`.
- The external TestFlight group `Friends & Family` has build 78 attached, feedback enabled, and its public link enabled with a 100-tester limit. The approved English beta description, feedback email, review contact and dedicated Clerk demo account are configured. Build 78 was submitted to Apple’s beta review and is currently `WAITING_FOR_REVIEW` (submission ID `7bb2df28-82d8-4ad0-988a-69f301f01629`).
- The App Store Connect API key is stored locally at `.release/appstore-connect/AuthKey_RRBPAL9WF4.p8` with mode `600`. `.release/` is ignored by `apps/frontend-expo/.gitignore`; never commit the key or copy its contents into tracked files. `eas.json` stores only the App Store app ID, key ID and issuer ID.
- The direct Apple uploader is `scripts/iphone/testflight.ts`. It reads `.release/production.env.json` for local builds, removes inherited `SDKROOT` when necessary, uses `/Applications/Xcode.app`, and never starts an Expo cloud build.

From this directory, repeat the workflow with:

```sh
pnpm build:testflight
pnpm validate:testflight -- .release/testflight-YYYY-MM-DDTHH-MM-SS-sssZ/tracking.so.ipa
pnpm submit:testflight -- .release/testflight-YYYY-MM-DDTHH-MM-SS-sssZ/tracking.so.ipa
```

The build command creates a new remote build number and writes a store-signed IPA under `.release/`. Validate the exact output before submitting it. `submit:testflight` uploads directly with Apple’s Xcode 26.6 `altool` and waits for `VALID`. TestFlight links and tester invitations are managed in [App Store Connect TestFlight](https://appstoreconnect.apple.com/teams/f2738712-afe4-496a-8317-a78e28ed722c/apps/6754610882/testflight). External testers require the prepared external group, either tester addresses or an explicitly enabled public link, Test Information and Apple beta review. The current group is configured but not yet submitted for review.

## Verification and delivery

The script verifies bundle ID, physical iOS platform, production backend/Clerk, fixture auth disabled, bundled JavaScript, the registered phone in an unexpired profile, release signing, and HealthKit/AppGroup entitlements. It verifies the provisioning CMS signature without Keychain imports; iOS still performs Apple's provisioning trust validation at install. The `codesign --verify --deep --strict` check must pass: do not bypass it.

The publisher uploads the IPA before the manifest, and the manifest before the installer. It GET-checks all three exact signed links before returning success. It does not claim physical installation succeeded until the user actually installs it.

For a new release, also complete checks appropriate to the source changes. Record version/build number, verification report and link expiry. Inspect latest feature markers/screens when needed. Do not publish an older IPA as if it contained current fixes. If an upload needs retrying, pass the new IPA explicitly to `build:iphone:publish` instead of recompiling.

Identity to preserve:

- EAS `@alramalho/tracking-so`, project `45c5e480-d33f-4c91-b692-520122979596`.
- Bundle `so.tracking.app`, Apple team `7P4CMS849D`.
- Registered iPhone `00008140-000148693CC0801C`.
- Profile `device-production`: internal/ad hoc, production environment, remote auto-increment. Do not hardcode the next build number.
- Existing capabilities: HealthKit and `group.so.tracking.app`.

Installing this bundle replaces the installed version on that phone. Ad hoc provisioning/certificates eventually expire; that is distinct from the download link's expiry. New phones need registration and a matching profile.

## Apple Watch companion — Expo migration

The companion now lives in `native/TrackingWatch/`. `plugins/with-watch.cjs` recreates its target and Embed Watch Content phase during clean prebuild, preserving `so.tracking.app.watchkitapp`, the existing Apple team, Apple sign-in and app group. The local Expo module in `modules/tracking-watch/` supplies phone authentication through WatchConnectivity. SwiftUI screens and direct production API calls remain native watchOS code.

The Watch AppIcon catalog uses a universal 1024px source with platform `watchos`. The old `watchOS`/`1024px` role configuration produced no icon. Keep the phone and Watch privacy resources separate; the plugin creates the phone manifest before CocoaPods aggregation. The iPhone target must explicitly depend on `TrackingWatch`. The JavaScript Xcode project library silently skips that dependency if its dependency/proxy sections do not exist; the plugin initializes both sections. A standalone Watch compile is insufficient: also compile the iPhone scheme and check its embedded Watch payload. Do not pass an iPhone-only `-sdk` override to the combined build; let the destination select each target's platform.

Signing was prepared September 15 using the existing distribution certificate and a separate Watch ad hoc profile containing the registered **Apple Watch Ultra 2 and paired iPhone 16 Pro**. EAS's device importer omits Apple Watches; its default generated profile contained only the iPhone and was replaced with the correct Apple-generated profile through `eas credentials` → `credentials.json` → Upload → Adhoc. The regular `device-production` remote credentials workflow is retained. Do not regenerate the Watch profile with only the EAS-listed iPhone.

Private signing files are ignored in `credentials.json`, `credentials/` and `.release/`; do not commit them. `.release/watch-device.json` contains the Watch registration returned by Apple's device API, including `deviceClass: "APPLE_WATCH"` and its `udid`. The artifact verifier requires that device in the Watch's actual embedded distribution profile. Another Mac needs the same verified device metadata, or an explicit `IPHONE_WATCH_DEVICE_FILE` pointing to its private JSON file. Never substitute an iPhone UDID for a Watch UDID.

Local combined compilation (from this frontend directory):

```sh
EXPO_NO_DOTENV=1 pnpm exec expo prebuild --platform ios --no-install
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer pod install --project-directory=ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -workspace ios/trackingso.xcworkspace -scheme trackingso -configuration Debug \
  -destination 'platform=iOS Simulator,id=47C54325-6609-4987-AA27-ACBFA499A1D5' \
  -derivedDataPath /private/tmp/tracking-watch-phone-simulator \
  CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=7P4CMS849D build
```

Prebuild may clear the ignored native directory, so rerun CocoaPods afterward. For a fixture-backed phone run use the loopback E2E environment documented below; never package fixture authentication in a device release. Watch simulator installed during this task: watchOS 26.5; simulator `AA80F632-92C6-47C7-9B35-DF09D258AF8C`, paired with the iPhone simulator above. Final launch/login-screen evidence is `.release/watch-validation/login-final.png`; complete simulator bundle verification is `.release/watch-validation/simulator.json`. Fresh combined compilation passed in `/private/tmp/tracking-watch-phone-complete.log`, and `/private/tmp/tracking-watch-final-check.log` records the final successful incremental check. Phone and Watch versions match at 1.0.0, the Watch icon compiles to `Assets.car`, and both simulator signatures pass. TypeScript and five release workflow tests pass. EAS builds 24 and 25 were stopped before export to include the metadata/icon corrections; neither was published.

The normal `build:iphone` / `build:iphone:local` / `build:iphone:publish` commands now verify any declared Watch companion's presence, matching phone/watch version and build numbers, watchOS platform, release signature, app identity, Apple sign-in/app-group entitlements and registered Watch provisioning. Installer pages add Watch instructions only when this verification succeeds. Build 23 has **no Watch companion**; do not present its installer as containing the port.

Installation: open the newly verified installer in iPhone Safari, install the phone app and sign in. If the Watch companion does not install automatically, open the iPhone's Watch app → My Watch → Available Apps → tracking.so → Install. Open tracking.so on the Watch with the signed-in phone app open once to synchronize credentials. Subsequent activity listing/logging uses the production API directly. The Mac and Metro are not needed. Physical installation and paired-device synchronization must still be confirmed on the user's devices. [Apple installation instructions](https://support.apple.com/en-au/109023).

The App Store readiness review is [recorded separately](../../docs/expo-store-review-2026-09-15.md). Watch restoration does not resolve the billing, social moderation, privacy/AI consent or deletion findings there.

## Watch activity ordering — live server change, September 15, 2026

The existing Watch activity list now receives activities sorted by most logged first from `/activities/`, matching the phone picker. Deleted logs do not count; ties retain newest-created-first ordering. The response fields are unchanged and the Watch does not download entry history. This backend-only change was deployed as `local/tracking-so-backend:watch-order-20260915` and is retained in the current `local/tracking-so-backend:interview-health-20260915` image; ordering required no IPA or Watch binary change. Relaunch the Watch app to fetch the new order. TypeScript, local database edge cases and independent production count comparisons passed. Deployment and rollback details are in [the backend runbook](../../hetzner/MIGRATION.md).

## Apple Health V0 — included in build 29

The new local `TrackingHealth` module, workout matching drawer and estimated Sleep score are implemented and simulator-tested. See [Health V0 flow and exact validation commands](../../docs/native-health-v0.md). The existing combined iPhone/Watch compile command above builds both native modules. Successful compilation evidence: `/private/tmp/tracking-health-native.log`; native permission/sync/review evidence: `/private/tmp/tracking-health-native-LIGHT-final.log`. The latter uses actual simulator HealthKit authorization and local fixture services, not real Watch records.

The scoped backend is deployed and verified as `local/tracking-so-backend:interview-health-20260915`. Local production build 29 contains the native Health module, permission purpose, workout review and estimated sleep score. The actual IPA and complete hosted download passed verification below. Build 26 lacks this flow. Real workout/sleep import on the paired devices remains for the user to verify.

## Current status — build 91, September 18, 2026

- **Local production build 91 is complete, verified and hosted**, version 1.0.0. It supersedes build 90 as the newest Safari-install artifact.
- The Add-page **Log voice note** card and Home **Voice note waiting** card now use a softer selected-theme accent. The mic is a larger standalone line icon with no filled accent badge, a little more surrounding padding, and the card sits above the **Log Activity** header; the border, chevron, lightbulb and review action use a more faded accent alpha so the card stays secondary to the activity tiles.
- A native iOS 26.5 simulator capture passed in dark amber using the rebuilt current native bundle: `test-results-native-ios/2026-09-18_083700/voice-note-ios/takeScreenshot/native-dark-add-voice-note.png`. The capture confirms the app-native surface, card/header ordering and no filled mic badge; the existing PWA capture is not used as native evidence.
- The friends list now sorts by total logged activity count, uses circular profile avatars, and keeps the native profile navigation inside the persistent tab layout.
- IPA: `.release/2026-09-18T07-37-51-001Z-4737d53b/tracking.so.ipa`. SHA-256: `f01346f0064cbc87c7ff168680fb65a6bf721bed5cc7eaed37e378f8d51706fe`. Phone and embedded Watch companion are both build 91 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T07-42-25-921Z-64a411d5/distribution.json`. Links expire **September 25, 2026, 07:42:31 UTC**. The publisher verified HTTP 200 for the installer, manifest and complete hosted IPA; the hosted IPA is build 91 and its SHA-256 matches the local artifact. The signed URL is intentionally not recorded here.
- The production backend overlay `local/tracking-so-backend:health-workout-graphs-20260918` is live and healthy, based on the active Garmin-backed image. It adds the Apple Health HR-series and route serializers while retaining elevation/zones. No database migration was required; rollback is preserved as `.env.before-health-workout-graphs-20260918` on the server.
- The build was compiled locally with the existing production environment and signing credentials; no Expo cloud quota, OTA publication, paid subscription or App Store submission was used. Expo Doctor still reports the pre-existing workspace-module gitignore warning and SDK patch-version drift; those did not prevent the signed archive. The same frontend source passed the DARK native iOS Maestro E2E in the preceding build, including the real MapKit route, elevation profile, HR chart, zones and colored icons; build 89 contains the same native markers.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/voice-log.spec.ts --reporter=line
pnpm build:iphone:local
node --import tsx scripts/iphone/cli.ts package .release/2026-09-18T07-37-51-001Z-4737d53b/tracking.so.ipa
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T07-37-51-001Z-4737d53b/tracking.so.ipa
```

## Previous release — build 83, September 17, 2026

- **Local production build 83 is complete, verified and hosted**, version 1.0.0. It supersedes build 80 as the newest Safari-install artifact.
- The voice-note review now compares extracted activities with the user's existing same-day entries before selection. A matching activity such as Running is shown under **Already logged** and excluded from the commit by default, so a voice note cannot count the same session twice. Exact-time notes still require an exact local-time match; day-only notes use the existing local-day entry.
- Future intention language is separated from completed logs. In the screenshot's wording, “I want to play every day…” is linked to the most recently mentioned Guitar activity even though the intention does not repeat the word guitar. The review drawer shows a restrained highlighted **This could become a plan** card with the extracted cadence/duration and two safe next steps: **Start a plan conversation** (the existing coach-led onboarding, prefilled with the voice goal) or **Ask coach instead** (opens the coach composer with context; it does not send automatically).
- An uncommitted review draft is persisted locally with AsyncStorage until the user saves or dismisses it. Home now shows a top-level blue **Voice note waiting** card with **Review note** and **Dismiss** actions. Leaving for plan onboarding and returning Home therefore preserves the review instead of losing it; dismissing or saving clears it.
- Add keeps **Log voice note** as a quieter blue secondary card. The principled drawer continues to show the transcript, selectable extracted activities/metrics, private note, unresolved items, and explicit final confirmation before any save.
- New focused browser coverage passes for the entry point, review/deduplication, pending draft/navigation/dismissal, and light/dark review screenshots. Existing Add-page logger and activity-editor regression coverage also passes.
- IPA: `.release/2026-09-17T22-42-28-691Z-voice-note-smart-pending/tracking.so.ipa`. SHA-256: `412aea5fe0a983291e965b2a26d2619ce80db8046c8a0665a44064e087e1dd4c`. Phone and embedded Watch companion are both build 83 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-17T22-47-22-116Z-3e010cca/distribution.json`. Links expire **September 24, 2026, 22:47:32 UTC**. The publisher verified HTTP 200 for the installer, manifest and complete hosted IPA, and the hosted IPA hash matches the local artifact. The signed URL is intentionally not recorded here.
- The build was compiled locally with the existing production environment and signing credentials; no Expo cloud quota, OTA publication, paid subscription, backend deployment or App Store submission was used. Expo Doctor still reports the pre-existing workspace-module gitignore warning and SDK patch-version drift; those did not prevent the signed archive.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/voice-log.spec.ts e2e/voice-log-review.spec.ts e2e/voice-log-pending.spec.ts --reporter=line
CI=1 node node_modules/@playwright/test/cli.js test e2e/logger.spec.ts e2e/activity-editor.spec.ts --reporter=line
pnpm build:iphone:local
node --import tsx scripts/iphone/cli.ts package .release/2026-09-17T22-42-28-691Z-voice-note-smart-pending/tracking.so.ipa
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-17T22-42-28-691Z-voice-note-smart-pending/tracking.so.ipa
```

## Previous release — build 80, September 17, 2026

- **Local production build 80 is complete, verified and hosted**, version 1.0.0. It is the newest published artifact and the one to install.
- Build 80 makes the Check-ins insights **Sleep score** row compact, so sleep reads as one more row beside the activity correlations instead of a block of its own. The row is now the 🛌 emoji and `Sleep score`, the reliability dot, the same green/red correlation bar the activity rows draw, the signed percentage, and a disclosure chevron. The three Good/Fair/Poor band bars and the explanatory copy moved behind that chevron, which uses `accessibilityState={{ expanded }}` and swaps lucide `ChevronDown`/`ChevronUp`. Collapsed, the row is visually indistinguishable in structure from gym, Chess and running.
- This reverses build 71's lucide **Moon** icon decision for the insights row only: rows there use the `{emoji} {title}` convention that the activity rows already follow, so the row now carries the 🛌 emoji and `sleepActivity.emoji` changed from 😴 to 🛌 in `src/features/metrics/model.ts`. The Health-tab card is unchanged.
- The bands are 8px inside the expanded detail instead of 12px, so the detail reads as secondary to the row rather than competing with it.
- Everything build 78 established about the sleep numbers is retained: a learning night is estimated from its computed components rather than scored zero, bands render from the first paired night, and the percentage and band averages still require the three paired nights a correlation needs.
- Build 71 adds the **Sleep score** row to the Check-ins insights island so sleep reads as one more contributor alongside activities. The row was previously missing entirely for an account whose synced nights are all still `learning`.
- Build 71 also fixes an out-of-range check-in bug found by querying the production database: the user's Happiness check-in on September 17 has a rating of 8, and the sleep bands are drawn against a 1–5 scale, so that average would have rendered a bar at 110% of its track. The sleep bands now use the same valid-rating filter as the heatmap, while the activity correlations keep their complete numeric history as before. With the filter applied the user's current data has two paired nights per metric, so the row renders with `—` until one more night pairs.
- Build 80 carries forward the workout elevation/heart-rate-zone and Health-tab Sleep score work described below, the Apple Watch voice-note refinement flow, and the Apple Health transient-failure recovery fix.
- The reported Health-screen 502s were an infrastructure interruption rather than an Apple Watch payload problem. Caddy logged `connect: connection refused` to the backend at `2026-09-17T15:15Z` for workouts, reconciliation preview, sleep and sync endpoints at the same time as unrelated API routes; the backend recovered and is currently healthy. No Health schema or Watch binary change was required for that incident.
- Apple Health 502/503/504 and network failures are now presented as temporary unavailability, retry automatically with bounded backoff, retry again when the app returns to the foreground, and expose a **Try again** action in both the workout-history and Apple Health sections. Existing workout data remains visible while a refresh fails.
- The Watch review screen now has **Save voice note**, **Make changes**, and **Start over**. Make changes records an incremental correction, sends the original transcript plus the current draft and follow-up transcript to the backend, and returns a new review draft. Examples include “change Energy to five out of five”, “remove the run”, or “scratch all the logs but keep the note”. Start over keeps the original full re-record behavior.
- Investigation of the reported delay found a 7.57-second preview request: speech-to-text completed after roughly 3.2 seconds and extraction used most of the remaining time. Existing logs did not expose a thinking-token breakdown, so the voice-log Luna request now uses **xhigh** reasoning (instead of max) and emits separate STT/model/total timing fields for future checks.
- The workout-details view now includes a route-derived elevation profile, a heart-rate chart, and a five-bar heart-rate-zone chart for running, with colored metric icons. On iOS, the route section uses a native Apple MapKit view with Apple map tiles, a yellow route polyline, and start/finish markers. HealthKit reads workout routes and the sync re-reads the full 30-day imported window so existing workouts can be enriched after an app update.
- Existing Apple Health connections now re-run authorization for the expanded read set, including workout routes. The upload sends the native requested-data list to the backend instead of the old workout/sleep-only list.
- The carried-forward production backend overlay `local/tracking-so-backend:health-elevation-20260917` remains live and healthy for Health elevation/zones. The HR-series/route backend overlay is prepared locally but has not been deployed to production yet. No database migration was required.
- This build gives the Health-tab **Sleep score** card the bar treatment the user expected: each component (Duration, Consistency, Interruptions) draws a bar against its own fixed point budget (50/30/20), and each night in the strip draws a bar for time asleep against the same 8-hour reference the Duration component scores against. A component still being learned shows an empty track with its `—/30` value instead of reading as a zero, and every recorded night keeps its bar even before a total exists.
- Build 65 fixed the bars on the Health-tab card. Build 71 extends the same treatment to the Check-ins insights row, which now renders even while every night is still learning.
- The bundled JavaScript contains the `Sleep score details` expander, the `correlation-sleep-score` row, `Good nights`, `Sleep pairs each check-in`, `Nights compared`, `estimated from their measured components`, `Time asleep on` and `8-hour reference` markers; all parity markers pass.
- IPA: `.release/2026-09-17T22-13-28-796Z-bdf8266d/tracking.so.ipa`. SHA-256: `0e5e6d0886059091cad5f7c43486bad437fc8c0a924113ccebf6f44c612bd9dc`. Phone and embedded Watch companion are both build 80 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-17T22-20-28-212Z-c4994cdb/distribution.json`. Links expire **September 24, 2026, 22:20:38 UTC**. The installer page, manifest and complete hosted IPA (26,209,878 bytes) all returned HTTP 200 in both light and dark, the Install link stayed `itms-services:`, neither theme overflowed horizontally, and the hosted IPA hash matches the local artifact.
- Both sleep insights browser cases pass, along with the sleep-correlation model tests and the repo-wide TypeScript check. The row's collapsed and expanded states were inspected in light and dark.
- The native iOS Maestro E2E passed in DARK, including workout details, elevation profile, heart-rate chart, real Apple MapKit route map, heart-rate zones and colored icons. Screenshots are under `test-results-native-ios/2026-09-17_224322/health-vitals-ios/takeScreenshot/`; the map screenshot was visually inspected for Apple map tiles and labels.
- The focused native verification passed. The repo-wide frontend TypeScript check still reports unrelated pre-existing `VoiceLogDrawer.tsx` errors. The build was compiled locally; no Expo cloud quota, OTA publication or App Store submission was used. The publisher’s build verification confirmed the production bundle, release signature, registered iPhone/Watch provisioning and both native app identities.
- The working tree is shared, so this build also carries the concurrent Apple Watch metrics changes present when it compiled.
- This build retains the Apple Watch **Log voice note** flow and fixes the recorder startup failure shown on-device (`OSStatus -50`). The Watch now uses a watchOS-compatible default recording mode instead of combining the record-only category with the playback-only spoken-audio mode. The flow still records up to 90 seconds, uses the existing Parakeet speech-to-text path, extracts activities/metrics/private notes with GPT-5.6 Luna at xhigh reasoning effort, and requires review before saving.
- The production backend overlay is live as `local/tracking-so-backend:voice-log-refinement-20260917c`, healthy at `https://api.tracking.so/health`, and the voice-log route remains protected by authentication. No database migration was required.
- Concurrent local builds for different apps share `~/Library/MobileDevice/Provisioning Profiles` and clobber it during export; do not run two EAS local builds at once.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
npx playwright test e2e/health.spec.ts e2e/polish.spec.ts --reporter=line
node --import tsx --test tests/*.test.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-17T22-13-28-796Z-bdf8266d/tracking.so.ipa 80
AWS_PROFILE=default ./node_modules/.bin/tsx scripts/iphone/cli.ts publish .release/2026-09-17T22-13-28-796Z-bdf8266d/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-17T22-20-28-212Z-c4994cdb/distribution.json
```

## Previous release — build 78, September 17, 2026

- **Local production build 78 is complete, verified and hosted**, version 1.0.0.
- IPA: `.release/2026-09-17T21-50-42-936Z-689d80e5/tracking.so.ipa`. SHA-256: `287bd8ceb5a50f4e3e55646542a53f3c5943ceb25529b28303227bbf7cd05fda`.
- Installer metadata: `.release/2026-09-17T21-56-52-352Z-380ab450/distribution.json`.
- Build 78 introduced the estimated-night quality, the lucide **Moon** insights icon and the Health-tab bar treatment; build 80 replaces the insights row with the compact emoji row and one correlation bar.

## Previous release — build 66, September 17, 2026

- **Local production build 66 is complete, verified and hosted**, version 1.0.0.
- IPA: `.release/2026-09-17T15-52-15-548Z-9668a5d7/tracking.so.ipa`. SHA-256: `8cb27e5268a53a76bc948ba0a1bcff191d02b743f14ae90484ece3a0cb5f867e`.
- Installer metadata: `.release/2026-09-17T18-10-48-771Z-8705f45b/distribution.json`.
- Build 66 added the Check-ins sleep row but still let an out-of-range check-in stretch a band bar; build 71 replaces it.

## Previous release — build 65, September 17, 2026

- **Local production build 65 is complete, verified and hosted**, version 1.0.0.
- IPA: `.release/2026-09-17T16-35-00-000Z-health-sync-retry/tracking.so.ipa`. SHA-256: `21b0ea716deba0a41642f853b6dc565d860e28228e751e5bb4bed0db3655b46f`. Both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-17T15-43-52-810Z-6a8b4a5d/distribution.json`.
- Build 65 gave the Health-tab Sleep score card its component and night bars, but the Check-ins insights island still showed no sleep row while every synced night was still learning.

## Previous release — build 57, September 17, 2026

- **Local production build 57 is complete, verified and hosted**, version 1.0.0.
- IPA: `.release/2026-09-17T15-25-00-000Z-voice-log-fix/tracking.so.ipa`. SHA-256: `0042358190e39e7a9453195d78eade5bd4f40102811f2d30a307229e52832a01`. Phone and embedded Watch companion are both build 57 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Build 57 does not contain the Sleep score card bars.

## Previous release — build 49, September 17, 2026

- **Local production build 49 is complete, verified and hosted**, version 1.0.0.
- IPA: `.release/2026-09-17T10-26-50-130Z-8a544750/tracking.so.ipa`. SHA-256: `84239f3fede585d9cb6189b2a693b4fe0d240ee744aeab38d2f043e1c1fdfe90`. Phone and embedded Watch companion are both build 49 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027. The phone profile contains 1 provisioned device and the Watch profile 2 (iPhone 16 Pro `00008140-000148693CC0801C` and Apple Watch Ultra 2 `00008310-0013233126D9A01E`).
- Installer metadata: `.release/2026-09-17T10-31-57-136Z-00284cd6/distribution.json`. Links expire **September 24, 2026, 10:32:03 UTC**. The installer page and manifest returned HTTP 200 and the complete hosted IPA (26,021,525 bytes) returned HTTP 200 with its SHA-256 matching the local artifact. The full light/dark Playwright installer check could not run headless in the sandbox (Chrome refused to launch), so the installer was validated by fetching the page, the `itms-services` manifest and the IPA directly; the earlier published build 47 retains its complete browser-check evidence.
- The onboarding gate fix that accompanied this build is **backend-only** and ships separately as production image `local/tracking-so-backend:onboarding-luna-20260917`; it changes no frontend code. See [the onboarding guide](../../docs/native-onboarding-interview.md).
- Backend TypeScript passed, the focused follow-through unit suite passed (27 tests), and no database migration was required. Build 49 was compiled locally; no Expo cloud quota, OTA publication or App Store submission was used.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
pnpm --filter backend-node exec tsc --noEmit
cd apps/frontend-expo
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-17T10-26-50-130Z-8a544750/tracking.so.ipa 49
node --import tsx scripts/iphone/cli.ts publish .release/2026-09-17T10-26-50-130Z-8a544750/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-17T10-31-57-136Z-00284cd6/distribution.json
```

## Previous release — build 43, September 16, 2026

- **Local production build 43 is complete, verified and hosted**, version 1.0.0. Profile → History now receives linked Apple Watch metadata through the activity-entry endpoint, so the owner's history cards show the same compact Apple Watch row and focused vitals detail as Timeline. The backend maps the reconciliation once and removes the join data before returning the response.
- Watch-derived values remain private by default. The existing explicit **Share with activity** choice controls what other viewers can see. No database migration was required; production image `local/tracking-so-backend:health-vitals-20260916d` is live and healthy.
- IPA: `.release/2026-09-16T19-45-52-509Z-c47914e6/tracking.so.ipa`. SHA-256: `de6b941e5f1b51d7bf1f978a566352ca42db5451377079c197a0cb5efcbd52ee`. Phone and embedded Watch companion are both build 43 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-16T19-51-31-742Z-df62ab8c/distribution.json`. Links expire **September 23, 2026, 19:51:38 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; the downloaded IPA is 25,997,843 bytes and its SHA-256 matches the local artifact. Light/dark mobile installer checks passed with the native Install scheme and no horizontal overflow.
- Frontend and backend TypeScript passed. The Health/vitals Playwright cases and release marker checks passed; build 43 was compiled locally with Xcode 26.6. No Expo cloud quota, OTA publication or App Store submission was used.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
pnpm --filter backend-node exec tsc --noEmit
cd apps/frontend-expo
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-16T19-45-52-509Z-c47914e6/tracking.so.ipa 43
python3 .release/check-health-effort-ipa.py .release/2026-09-16T19-45-52-509Z-c47914e6/tracking.so.ipa 43
node --import tsx scripts/iphone/cli.ts publish .release/2026-09-16T19-45-52-509Z-c47914e6/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-16T19-51-31-742Z-df62ab8c/distribution.json
```

## Previous release — build 39, September 16, 2026

- **Local production build 39 is complete, verified and hosted**, version 1.0.0. Apple Watch vitals now belong to the tracking.so activity: the owner's profile/timeline card shows one compact Apple Watch row with the most useful available signals, and tapping it opens a focused detail screen headed by the linked activity and amount. Missing Health values are omitted instead of rendering empty fields.
- Watch data is private by default. During reconciliation the user can explicitly choose **Share with activity**; only then does the compact Watch summary appear to other people wherever that activity is rendered. Existing linked workouts have no share flag and remain private. The backend strips Watch-derived exact times, duration and distance from non-owner responses when the workout is private.
- The Health inbox uses one dominant review action and continues through pending workouts as a batch. Resolved workouts open their vitals. The native Health module registers a workout observer, requests immediate background delivery and can show **Workout detected** when notification permission already exists; app activation remains the reliable sync fallback because iOS controls background scheduling and access to protected Health data.
- IPA: `.release/2026-09-16T12-59-18-262Z-9b5a4b42/tracking.so.ipa`. SHA-256: `97243edb36c07cff8ea7cd80f45bb0da381b78408a72b99f12a3bc7f71cb1238`. Release reports verify build 39, production configuration, bundled JavaScript, release signatures, registered phone/Watch provisioning, and the native Health/Watch modules. The actual embedded phone profile contains both HealthKit and HealthKit background-delivery entitlements.
- Installer metadata and signed URL: `.release/2026-09-16T12-59-18-262Z-9b5a4b42/distribution.json`. Links expire **September 23, 2026, 13:03:46 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; downloaded size is 26,035,389 bytes and SHA-256 matches the local artifact. Mobile-width installer checks passed in light and dark, with the native Install scheme and no horizontal overflow.
- Phone and Watch are both build 39; both profiles expire September 10, 2027. Installing from Safari replaces the prior build and keeps app data. Physical installation and real locked-phone HealthKit background timing remain for the user to confirm.
- Frontend and backend TypeScript passed. All 57 frontend unit tests, 14 focused backend reconciliation/schema tests, and the final ten Health/vitals Playwright cases passed. The focused browser screenshots for workout review and the activity-linked vitals screen were inspected. Backend integration tests could not start because the local PostgreSQL test service at `127.0.0.1:55322` was not running; the deployed production health endpoint and unauthenticated route enforcement were checked separately.
- Backend image `local/tracking-so-backend:health-vitals-20260916c` is live and healthy with no database migration. Build 38 was stopped before export for the final detail-header polish and was never published. Build 39 was compiled locally on Xcode 26.6. No Expo cloud quota, OTA publication or App Store submission was used.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
pnpm --filter backend-node exec tsc --noEmit
pnpm --filter frontend-expo test
pnpm --filter backend-node exec node --import tsx --test src/services/health/apple/reconciliation/service.test.ts src/services/health/apple/schemas.test.ts
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/health.spec.ts e2e/workout-vitals.spec.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-16T12-59-18-262Z-9b5a4b42/tracking.so.ipa 39
python3 .release/check-health-effort-ipa.py .release/2026-09-16T12-59-18-262Z-9b5a4b42/tracking.so.ipa 39
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-16T12-59-18-262Z-9b5a4b42/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-16T12-59-18-262Z-9b5a4b42/distribution.json
```

## Previous release — build 37, September 16, 2026

- **Local production build 37 is complete, verified and hosted**, version 1.0.0. A workout with one plausible existing log now opens with that strongest candidate already selected, including when Apple Health and the manual log use different quantities. The user can link immediately or open **Change workout match**. Build 36's compact Home prompt, continuous batch review, explicit heart-rate provenance and all earlier onboarding/Watch behavior are retained.
- Ambiguous, possible-duplicate and unit-incompatible results do not receive a silent default. They open the existing **Choose a match** view directly with the conflict reason and require a deliberate selection before the single **Link workout** action appears. Backend candidates remain limited to semantically compatible logs on the workout's local day; no extra conflict flow was added.
- IPA: `.release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa`. SHA-256: `028fd9ac5c8086c8a562e82ad1155d40f01f56f8244d6773d09c9516fc48eddf`. Release reports verify build 37, production configuration, release signatures, registered phone/Watch provisioning, retained native Health/Watch/ExpoAudio modules and all previous feature markers. `auto-match-markers.json` verifies the new selection and conflict-gate functions in the IPA's actual bundled JavaScript.
- Installer metadata and signed URL: `.release/2026-09-16T12-34-51-758Z-8e3a6d63/distribution.json`. Links expire **September 23, 2026, 12:34:59 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; downloaded size is 26,025,901 bytes and SHA-256 matches the local artifact. Mobile-width installer checks passed in light and dark, with the native Install scheme and no horizontal overflow.
- Phone and Watch are both build 37; both profiles expire September 10, 2027. Installing from Safari replaces the prior build and keeps app data. Physical installation remains for the user to confirm.
- Frontend TypeScript, seven focused effort/date/matching model tests and all nine Health browser cases passed. The browser conflict case opens the chooser directly; the native fixture sets `recommendedAction` to null with a value mismatch and still verifies the best existing log is selected without the extra chooser step. Full native iOS Health flows passed in DARK and LIGHT, including amount/match/create paths, two-workout batch transition, sleep screens and simulator Health authorization/sync. Screenshots were inspected at `test-results-native-ios/2026-09-16_132757/health-ios/takeScreenshot/` and `2026-09-16_132855/health-ios/takeScreenshot/`.
- Compiled locally on Xcode 26.6. No Expo cloud quota, OTA publication, backend deployment or App Store submission was used. Logs: `/private/tmp/tracking-health-auto-match-build.log`, `/private/tmp/tracking-health-auto-match-publish.log`, `/private/tmp/tracking-health-auto-match-hosted.log`, `/private/tmp/tracking-health-auto-match-native-DARK.log` and `/private/tmp/tracking-health-auto-match-native-LIGHT.log`. The publication log contains the private signed URL.

Exact release commands from this frontend directory:

```sh
pnpm exec tsc --noEmit
node --import tsx --test tests/workout-effort.test.ts tests/workout-review-date.test.ts
CI=1 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/health.spec.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
python3 .release/check-follow-through-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
python3 .release/check-weekly-profile-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
python3 .release/check-assistance-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
python3 .release/check-interview-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
python3 .release/check-health-effort-ipa.py .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa 37
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-16T12-29-51-136Z-22afb6cc/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-16T12-34-51-758Z-8e3a6d63/distribution.json
```

## Previous release — build 35, September 16, 2026

- **Local production build 35 is complete, verified and hosted**, version 1.0.0. Native onboarding now restores microphone dictation through the authenticated production STT route. Transcripts append to existing typed text. Each semantic answer now passes through a dedicated coach validation screen with the coach avatar, stable word-by-word fade-in, a Continue action revealed after the message, and a twelve-second growing automatic-continue bar. Rejected answers return to the same question with a concrete-answer help card.
- Production speech-to-text is configured server-side through OpenRouter model `nvidia/parakeet-tdt-0.6b-v3`; no provider credential is bundled in the app. The deployed backend selected Parakeet at startup and accurately transcribed a synthetic M4A request through the live STT service. OpenRouter lists this model at `$0.0015/minute`; the request path remains the authenticated `/ai/transcribe` route.
- IPA: `.release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa`. SHA-256: `1d961ccff47e4317375b4c4f4514c94d6611bf02587dfc6a3ad32af7b75e4710`. The release reports verify build 35, production configuration, release signatures, registered phone/Watch provisioning, the microphone purpose, statically linked ExpoAudio implementation, all new dictation/coach markers, and retained Health/effort markers.
- Installer metadata and signed URL: `.release/2026-09-16T08-31-56-623Z-6e1d7f59/distribution.json`. Links expire **September 23, 2026, 08:32:02 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; downloaded size is 26,023,654 bytes and SHA-256 matches the local artifact. Mobile-width installer checks and screenshot inspection passed in light and dark, with the native Install scheme and no horizontal overflow.
- Phone and Watch are both build 35; both profiles expire September 10, 2027. Installing from Safari replaces the prior build and keeps the app's data. Physical installation and real-device microphone capture remain for the user to confirm.
- Frontend/backend TypeScript and the focused backend STT configuration tests passed. The final onboarding browser suite passed all eight cases, including timed automatic continuation. Full native DARK/LIGHT onboarding flows passed, and a native dictation flow verified a non-empty recorded M4A upload plus append-not-replace behavior. Native compilation included ExpoAudio 57.0.5 and the release IPA contains its implementation.
- Build 34 was stopped before export so `expo-asset` could be made an explicit dependency; it was never published. Build 35 was compiled locally on Xcode 26.6. No Expo cloud quota, OTA publication or App Store submission was used. Logs: `/private/tmp/tracking-dictation-release-build.log`, `/private/tmp/tracking-dictation-release-publish.log` and `/private/tmp/tracking-dictation-release-hosted.log`; the publication log contains the private signed URL.

Exact release commands from this frontend directory:

```sh
pnpm exec tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/onboarding-flow.spec.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
python3 .release/check-follow-through-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
python3 .release/check-weekly-profile-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
python3 .release/check-assistance-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
python3 .release/check-interview-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
python3 .release/check-health-effort-ipa.py .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa 35
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-16T08-26-01-601Z-a820a0cf/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-16T08-31-56-623Z-6e1d7f59/distribution.json
```

## Previous release — build 33, September 16, 2026

- **Local production build 33 is complete, verified and hosted**, version 1.0.0. Apple Health workout reconciliation now prefers the user's Apple effort rating, falls back to Apple's estimated effort and maps the 1–10 value into the existing five difficulty choices. It fills only an unanswered difficulty; a value already selected in tracking.so is preserved. Average/maximum workout heart rate is retained as private workout metadata, while the review UI shows one quiet summary such as **Watch estimate · Moderate · 151 bpm avg**. Heart rate alone does not invent a difficulty. Manual integer logging and build 32's precise connected measurement display remain unchanged.
- IPA: `.release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa`. SHA-256: `78d1a4afe150a9aa9967ca58bea3fccb283ca59d4a0ef8b6f1d5439c783aa59a`. The release report verifies build 33, production configuration, release signatures and registered phone/Watch provisioning. The dedicated Health report verifies the bundled effort UI, `HKWorkoutEffortRelationshipQuery`, Apple user/estimated effort identifiers, heart-rate import and the updated Health purpose string in the actual IPA.
- Installer metadata and signed URL: `.release/2026-09-16T08-24-27-326Z-c3007e1e/distribution.json`. Links expire **September 23, 2026, 08:24:37 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; downloaded size is 26,023,671 bytes and SHA-256 matches the local artifact. Mobile-width installer checks passed in light and dark, with the native Install scheme and no horizontal overflow.
- Phone and Watch are both build 33; both profiles expire September 10, 2027. Installing from Safari replaces build 32 and keeps the app's data. Physical installation and a real workout with Apple effort/heart-rate availability remain for the user to confirm.
- Backend and frontend TypeScript passed. Seventeen backend schema/effort/persistence tests and nine frontend effort/date tests passed. The focused DARK workout review passed in Playwright; the LIGHT flow completed and its screenshot was inspected, though Playwright later hit a trace-file cleanup error. Native simulator compilation passed against the iOS 26.5 SDK. The production backend effort overlay is deployed and healthy; no database migration was needed.
- Compiled locally on Xcode 26.6. No Expo cloud quota, OTA publication or App Store submission was used. Logs: `/private/tmp/tracking-health-effort-build33.log`, `/private/tmp/tracking-health-effort-publish33.log` and `/private/tmp/tracking-health-effort-hosted33.log`; the publication log contains the private signed URL.

Exact release commands from this frontend directory:

```sh
pnpm exec tsc --noEmit
node --import tsx --test tests/workout-effort.test.ts tests/workout-review-date.test.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
python3 .release/check-follow-through-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
python3 .release/check-weekly-profile-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
python3 .release/check-assistance-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
python3 .release/check-interview-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
python3 .release/check-health-effort-ipa.py .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa 33
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-16T08-16-31-819Z-329e1522/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-16T08-24-27-326Z-c3007e1e/distribution.json
```

## Previous release — build 30, September 15, 2026

- **Local production build 30 is complete, verified and hosted**, version 1.0.0. It adds the simplified workout-matching drawer: one dominant commit action, compact workout summary, editable match/amount rows, focused checkmarked choice views, activity-specific icons, quiet Skip, and a keyboard-safe create-activity path. Build 29's coach onboarding, settings/activity-editor parity, Apple Health V0 and Watch companion are retained.
- IPA: `.release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa`. SHA-256: `8a0792c78545e1733d90540b18f8da892c2254d5431b4d33456327eb2e471a90`. The reports beside it verify release signing, production configuration, registered iPhone/Watch provisioning and all retained feature markers; explicit bundle markers verify **Link workout**, **Change workout match**, **Which amount?**, **Create and log workout**, and the final count-once copy.
- Installer metadata and signed URL: `.release/2026-09-15T18-41-09-779Z-54b53667/distribution.json`. Links expire **September 22, 2026, 18:41:15 UTC**. The installer, manifest and complete hosted IPA returned HTTP 200; downloaded size is 25,893,623 bytes and SHA-256 matches the local artifact. Mobile-width installer checks passed in light and dark, with the native Install scheme and no horizontal overflow.
- Phone and Watch are both build 30, bundle IDs `so.tracking.app` and `so.tracking.app.watchkitapp`; both provisioning profiles expire September 10, 2027. Physical installation of build 30 remains for the user to confirm.
- Before compilation, TypeScript, eight browser Health cases, and native DARK/LIGHT flows passed. They cover create/choose/skip, ambiguous matches, failed-save retry, measurement changes staying unwritten until the final action, create-input keyboard handling, Health authorization/sync and sleep-score regression. The before/after hierarchy and screenshots were independently reviewed before the concise interface rules were retained in AGENTS.md.
- Compiled locally on Xcode 26.6. No Expo cloud quota, OTA publication or App Store submission. Logs: `/private/tmp/tracking-workout-build30.log`, `tracking-workout-build30-publish.log`, and `tracking-workout-build30-hosted.log`. The publish log contains a signed URL and must remain private.

Exact release commands from this frontend directory:

```sh
pnpm exec tsc --noEmit
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa 30
python3 .release/check-follow-through-ipa.py .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa 30
python3 .release/check-weekly-profile-ipa.py .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa 30
python3 .release/check-assistance-ipa.py .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa 30
python3 .release/check-interview-ipa.py .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa 30
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-15T18-36-22-665Z-183f28fd/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-15T18-41-09-779Z-54b53667/distribution.json
```

## Previous release — build 29, September 15, 2026

- **Local production build 29 is complete, verified and hosted**, version 1.0.0. Includes the coach-style AI onboarding, five-section progress, extraction/confirmation and tailored clarifications, preview sharing the real component/endpoint, Home reveals, final keyboard fixes, settings subdrawer parity, activity editor parity and Apple Health V0. Watch companion and previous features are retained.
- Preview intercepts account writes and payment. Real onboarding persists progress and resumes a pending upgrade; verified backend entitlement immediately completes/opens the plan. **Apple StoreKit purchase/restore is still unfinished; the current checkout is web-based.** No real subscription was purchased in validation.
- IPA: `.release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa`. Reports beside it: `verified.json`, `parity-markers.json`, `follow-through-markers.json`, `weekly-profile-markers.json`, `assistance-markers.json`, `interview-health-editor-markers.json`. SHA-256: `0b0318a60a8cf940cc4366312966912cd7f5fdfe769e1088c05ee02447c42caf`.
- Installer metadata and signed URL: `.release/2026-09-15T16-40-08-907Z-b8890ba2/distribution.json`. Links expire **September 22, 2026, 16:40:16 UTC**. Republish this exact verified IPA to renew without compiling. Never commit signed URLs.
- Actual IPA passed production API/live Clerk, fixture-disabled configuration, bundled JS (9,629,386 bytes), strict release signatures, registered iPhone and Watch provisioning, matching version/build and native Health/Watch modules. Both profiles expire September 10, 2027. Physical installation of this new build remains for the user to confirm; the user reported the previous Watch companion working.
- Hosted installer, manifest and complete IPA returned HTTP 200. Downloaded IPA is 25,889,886 bytes and SHA-256 matches the local artifact. Mobile-width installer checks passed in light/dark modes, including native Install scheme and no horizontal overflow. Evidence: `browser-check.json`, `installer-light.png`, `installer-dark.png` beside distribution metadata.
- Frontend/backend TypeScript passed. Eight main browser cases plus the rejected-refinement persistence regression passed. Full native DARK/LIGHT onboarding/settings flows and final targeted keyboard checks passed; screenshots were inspected. Backend: 39 unit cases, five isolated Health persistence cases and six actual-model synthetic checks passed. See [onboarding validation](../../docs/native-onboarding-interview.md) and [activity editor validation](../../docs/native-activity-editor.md) for commands and limits.
- Backend image `local/tracking-so-backend:interview-health-20260915` is live and healthy: 19 source hashes match, health returns 200 and authenticated interview/Health/activity routes return 401 without credentials. Deployment and rollback are in [the backend runbook](../../hetzner/MIGRATION.md). No migration or production test-data writes.
- Builds 27 and 28 were compiled but never published: 27 lacks settings/interview changes; 28 lacks final keyboard/refinement corrections. Build 29 supersedes hosted build 26. Compiled locally on Xcode 26.6; no Expo cloud quota, OTA or App Store submission.
- Logs: `/private/tmp/tracking-onboarding-production-final-build.log`, `/private/tmp/tracking-onboarding-production-publish.log`, `/private/tmp/tracking-onboarding-hosted.log`. Publication log contains a signed URL and must remain private. Source remains uncommitted and must be retained.

Exact commands from this frontend directory:

```sh
pnpm exec tsc --noEmit
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa 29
python3 .release/check-follow-through-ipa.py .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa 29
python3 .release/check-weekly-profile-ipa.py .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa 29
python3 .release/check-assistance-ipa.py .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa 29
python3 .release/check-interview-ipa.py .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa 29
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-15T16-33-41-465Z-e6348c67/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-15T16-40-08-907Z-b8890ba2/distribution.json
```

Build/publish commands create new timestamped paths. The paths above identify this completed release; read the actual output for future releases. The `.release` audit scripts are ignored local verification helpers.

## Previous release — build 26, September 15, 2026

### Production notification transport audit — September 15, 2026

- Expo uses `getDevicePushTokenAsync()` and the unchanged backend sends directly to APNs; never replace the stored token with an Expo push token. Build 26 has the production `aps-environment` entitlement, bundle `so.tracking.app` and Apple team `7P4CMS849D`.
- The Hetzner backend now mounts the existing Apple `.p8` as a read-only runtime secret and logs `APNs provider initialized (production)`. The key is excluded from Git/Docker images. A live send reached Apple but the most recently stored pre-Expo token was rejected as `BadDeviceToken`, proving credentials/transport are live while that device registration is stale.
- Source after build 26 automatically reconciles a previously enabled account with the current device's raw APNs token on launch/foreground, preserves an explicit local opt-out and unregisters the server token before logout. The backend now clears Apple rejection reasons `BadDeviceToken`, `DeviceTokenNotForTopic` and `Unregistered` rather than retrying stale tokens.
- **Build 26 does not contain automatic reconciliation.** To refresh it immediately, open Settings, toggle Push Notifications off and on, and accept permission if asked. Do not claim physical notification delivery until a subsequent test succeeds. A future IPA must include and verify the reconciliation source before describing this as automatic.
- Operational Telegram is independent of the Expo client. Production `@trackingso_bot` now sends routine product activity to the original private chat and high-priority 5xx, billing/upgrade, important bug/account and CI events to the dedicated **Important App Alerts** group. A live group message passed.

Repeatable source and production checks:

```sh
pnpm --filter frontend-expo typecheck
pnpm --filter frontend-expo test
pnpm --filter backend-node exec tsc --noEmit
pnpm --filter backend-node exec vitest run src/services/telegram/service.test.ts src/services/apns/model.test.ts
ssh -i ~/.ssh/hetzner_ed25519 root@89.167.84.67 \
  'docker exec tsw-backend pnpm check-telegram -- --require-dedicated-alerts'
```

The Telegram check prints masked destination identities only. Verify the actual release entitlement by extracting the new IPA and running `codesign -d --entitlements :-` against its phone `.app`; the normal release verifier remains authoritative for bundle, signing, production config and provisioning.

**Historical user follow-up (subsequently reported working):** after updating the iPhone, the Watch now prompts for Developer Mode when launching the app. The previous transfer failure appears cleared; launch and authentication remain unconfirmed. For this internal test build, enable Developer Mode directly on the Watch under Settings → Privacy & Security, restart and confirm. iOS 27 is not required by build 26.

**Historical physical Watch installation issue (subsequently reported working):** the user received “This app could not be installed at this time” on September 15. Static IPA/signature and hosted checks passed, but Watch installation is not confirmed. Captured iPhone logs show `ACXErrorDomain Code=8` / IdentityServices Code 20, “Socket open timed out”, during preparation of the transfer after approximately 64 seconds (14:44 and 14:45 local). iPhone runs iOS 26.5.2; Ultra 2 runs watchOS 26.6. This matches the Apple-acknowledged likely regression discussed at https://developer.apple.com/forums/thread/827053. One community report with the same mixed OS versions resolved it after updating both devices to 26.6; that remedy is not yet verified here. No packaging rebuild is justified by these transport errors. Evidence: `/private/tmp/tracking-watch-install-diagnosis/20260915-144906/install.txt`. Do not describe the companion as physically validated.

- **Local production build 26 is complete, verified and hosted**, version 1.0.0. Includes the compact Schedule / Reminders / Weekly review controls, separate icon-led native sheets and the restored Apple Watch companion. All prior parity, onboarding and weekly/profile corrections are retained. No backend change is required for these controls.
- IPA: `.release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa`. Reports beside it: `verified.json`, `parity-markers.json`, `follow-through-markers.json`, `weekly-profile-markers.json`, `assistance-markers.json`, `watch-audit.json`. SHA-256: `c00efd9fc5c2aaa4a92526d8daf7309c34f809df751fe5c8af51e78dc201f1c8`.
- Installer metadata and signed URL: `.release/2026-09-15T13-35-02-155Z-93039d53/distribution.json`. Links expire **September 22, 2026, 13:35:08 UTC**. Republish this exact IPA to renew without compiling; do not commit signed URLs.
- Actual IPA passed production API/live Clerk, fixture-disabled configuration, bundled JS (9,554,241 bytes), strict release signatures, both device profiles and entitlements. Embedded Watch has matching version/build, physical watchOS binary, compiled AppIcon and registered Watch provisioning. Both profiles expire September 10, 2027.
- Hosted installer, manifest and complete IPA returned HTTP 200; downloaded IPA is 25,818,282 bytes and its SHA-256 matches. Mobile-width installer checks and visual inspection passed in light/dark modes, including Safari Install scheme and Watch instructions. Evidence: `browser-check.json`, `installer-light.png`, `installer-dark.png` beside distribution metadata. Physical installation and paired-device synchronization remain for the user to confirm.
- Assistance TypeScript, four browser scenarios and DARK/LIGHT native flows passed. Full DARK flow also passed with the actual compiled Watch module. See [assistance validation](../../docs/native-plan-assistance.md). Fresh combined native compilation and Watch packaging checks passed before release.
- Builds 24 and 25 were intentionally interrupted before export for Watch version/icon corrections. Neither was published. Build 26 supersedes hosted build 23.
- Logs: `/private/tmp/tracking-assistance-watch-release-build.log`, `tracking-assistance-watch-release-publish.log`, `tracking-assistance-watch-release-hosted.log`. Compiled locally on Xcode 26.6. No Expo cloud quota, OTA or store submission. Source remains uncommitted and must be retained.

Exact release commands from this frontend directory:

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa 26
python3 .release/check-follow-through-ipa.py .release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa 26
python3 .release/check-weekly-profile-ipa.py .release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa 26
python3 .release/check-assistance-ipa.py .release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa 26
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-15T13-30-14-866Z-4cbe83cf/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-15T13-35-02-155Z-93039d53/distribution.json
```

## Previous release — build 23, September 15, 2026

- **Local production build 23 is complete, verified and hosted**, version 1.0.0. Includes default first-plan selection, pill progress with plus overflow, ordinary logging for flexible weekly targets, compact This week, simpler scheduled-session controls and profile glimmer/tighter grid/fire markers. Flexible onboarding skips session-only questions. All build-22 and earlier parity features are retained.
- IPA: `.release/2026-09-15T10-59-35-202Z-b0333009/tracking.so.ipa`. Verification reports: `verified.json`, `parity-markers.json`, `follow-through-markers.json`, `weekly-profile-markers.json` beside it. SHA-256: `1b957f00239c3c8b3678b990ff2973027e011122a64674efe9996aeca6778c0c`.
- Installer metadata and signed URL: `.release/2026-09-15T11-04-16-834Z-e342347b/distribution.json`. Links expire **September 22, 2026, 11:04:25 UTC**. Republish this exact IPA to renew without recompiling.
- Actual IPA passed production API/live Clerk, fixture disabled, bundled JS (9,540,029 bytes), strict release signing, registered iPhone provisioning and entitlements. Calendar/Clipboard native implementations and all retained/new feature markers passed. Profile expires September 10, 2027.
- Hosted installer, manifest and complete IPA returned HTTP 200. Download is 24,632,690 bytes and SHA-256 matches local. Light/dark Safari installer checks passed and screenshots were inspected. Evidence: `browser-check.json`, `installer-light.png`, `installer-dark.png` beside installer metadata. Physical installation remains for the user to confirm.
- Backend corrections are deployed and healthy as `local/tracking-so-backend:weekly-profile-20260915`; no migration required. All five deployed source hashes match local. Backend TypeScript plus 21 follow-through/Wrapped/search tests passed. Prior dark/light native flexible/profile and scheduled timer/calendar tests, browser cases and PostgreSQL checks are recorded in [the correction notes](../../docs/native-weekly-profile-polish.md), with deployment and rollback commands.
- Logs: `/private/tmp/tracking-weekly-profile-build.log`, `tracking-weekly-profile-publish.log`, `tracking-weekly-profile-hosted.log`. Compiled locally using Xcode 26.6/iOS 26.5. No Expo cloud quota, OTA or App Store submission. Source remains uncommitted and must be retained in future source deployments.

Exact commands from this directory (use actual next paths/build number for subsequent releases):

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-15T10-59-35-202Z-b0333009/tracking.so.ipa 23
python3 .release/check-follow-through-ipa.py .release/2026-09-15T10-59-35-202Z-b0333009/tracking.so.ipa 23
python3 .release/check-weekly-profile-ipa.py .release/2026-09-15T10-59-35-202Z-b0333009/tracking.so.ipa 23
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-15T10-59-35-202Z-b0333009/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-15T11-04-16-834Z-e342347b/distribution.json
```

## Previous release — build 22, September 15, 2026

- **Local production build 22 is complete, verified and hosted**, version 1.0.0. Includes revised single-input onboarding, saved coaching answers, late free/trial choice, safe onboarding preview, faithful Settings drawer, compact Home checks/Up next, Plans This week, session timers/logging/resources/move/skip, opt-in reminders and quiet coach reach-outs, calendar connection, optional circles and corrected Lifestyle/circular streak overflow. Existing Add, chat and previous parity fixes remain.
- IPA: `.release/2026-09-15T10-02-06-017Z-72738bf4/tracking.so.ipa`. Reports: `verified.json`, `parity-markers.json`, `follow-through-markers.json` beside it. SHA-256: `a7134990d4ed84ac21c81e3a1f1b3b9a58be307534a96daa027faab06b057272`.
- Installer metadata and signed URL: `.release/2026-09-15T10-06-25-897Z-5e28c425/distribution.json`. Links expire **September 22, 2026, 10:06:31 UTC**. Republish that exact IPA to renew without compiling.
- Actual IPA passed production API/live Clerk, fixture disabled, bundled JS (9,533,842 bytes), strict release signing, registered iPhone provisioning and entitlements. New/retained feature markers, compiled ExpoCalendar/ExpoClipboard and calendar permission purpose passed. Profile expires September 10, 2027.
- Hosted installer, manifest and complete IPA returned HTTP 200. Download is 24,628,642 bytes and its SHA-256 matches local. Both installer themes passed mobile width and Safari Install-button checks; screenshots inspected. Evidence: `browser-check.json`, `installer-light.png`, `installer-dark.png` beside distribution metadata. Physical installation remains for the user to confirm.
- Backend deployed with two additive migrations; production health verified. Detailed scope, limitations, deployment and rollback: [native follow-through runbook](../../docs/native-follow-through.md). Source remains uncommitted and must be retained in the next normal source deployment.
- Backend/native TypeScript, 17 backend tests, 9 native model tests, isolated real PostgreSQL concurrency/ownership tests, 33 distinct browser scenarios across final runs, native onboarding/session flows in DARK and LIGHT, and actual iOS Calendar persistence passed. Final native calendar run: `test-results-native-ios/2026-09-15_110432/sessions-ios/`; future session persisted exactly once and skipped session absent. Gateway smoke checks used three user-relevant scenarios, six actual calls; no multi-model benchmark claimed.
- Build log `/private/tmp/tracking-followthrough-production-build-final.log`; publication log `/private/tmp/tracking-followthrough-production-publish.log`; hosted checks `/private/tmp/tracking-followthrough-hosted-verification.log`. Xcode 26.6/iOS 26.5, local Mac compile. No Expo cloud build quota, OTA or App Store submission.
- Build 21 was intentionally interrupted before a final artifact for the Back-button correction. It was not published and must not be offered as this release.

On the phone, open Profile → Settings → **Preview onboarding**. It starts a fresh labelled flow using the real question generator and offer, without saving answers, creating plans or starting billing. Actual signup/checkout testing needs a separate account; existing accounts are never reset. Preview is visible and not an admin/entitlement bypass. Store review and new public-circle moderation requirements remain separate from this ad hoc test build.

Exact release commands from this directory:

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-15T10-02-06-017Z-72738bf4/tracking.so.ipa 22
python3 .release/check-follow-through-ipa.py .release/2026-09-15T10-02-06-017Z-72738bf4/tracking.so.ipa 22
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-15T10-02-06-017Z-72738bf4/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-15T10-06-25-897Z-5e28c425/distribution.json
```

The build command auto-increments; for subsequent releases use its actual new artifact/build number. The explicit paths above reproduce verification/hosting of build 22 only. Keep all signed links in ignored `.release/` metadata.

## Previous release — build 20, September 14, 2026

- **Local production build 20 is complete, verified and hosted**, version 1.0.0. Conversation now has a centered down-arrow above the composer when scrolled away from recent messages. It jumps to the latest message, hides near the bottom and respects Reduce Motion. All build-19 drawer fixes and earlier annual Wrapped/search/photo/glass changes are retained.
- IPA: `.release/2026-09-14T19-21-33-834Z-1b0ca03a/tracking.so.ipa`; `verified.json` and `parity-markers.json` are beside it. SHA-256: `b28bd2acc08a6b880084d45ee8a14e78207d25f254e06abe3c8282c9748a99af`.
- Installer metadata and signed URL: `.release/2026-09-14T19-26-18-016Z-fe2ee70a/distribution.json`. Links expire **September 21, 2026, 19:26:23 UTC**. Republish this exact verified IPA to renew them without recompiling.
- The actual IPA passed production API/live Clerk, fixture-disabled, bundled JavaScript (9,320,365 bytes), strict release signature, registered iPhone provisioning and entitlement checks. The `Scroll to latest message` marker and all retained parity markers passed. The profile expires September 10, 2027.
- Installer, manifest and full IPA returned HTTP 200. The hosted IPA is 24,408,305 bytes and its SHA-256 matches the local artifact. Light/dark installers passed mobile-width and native Install-button checks and were visually inspected. Evidence is in `browser-check.json` and `installer-light.png` / `installer-dark.png` beside distribution metadata. Physical installation remains for the user to confirm.
- TypeScript passed (`/private/tmp/tracking-chat-arrow-types.log`). All five existing chat browser E2E cases passed again (`/private/tmp/tracking-chat-arrow-messages.log`), covering both themes, proposals/feedback/retry/direct messages, editing/settings/new conversation and image attachments. Manual mobile-browser checks with a 40-message fixture passed in dark/light (light with Reduce Motion): the arrow appears when scrolled up, is centered, returns within 100px of the bottom and hides, without page errors. Captures: `/private/tmp/tracking-chat-arrow-DARK.png` and `/private/tmp/tracking-chat-arrow-LIGHT.png`. No arrow-specific native simulator run is claimed; the unchanged build-19 native drawer checks remain recorded below.
- Build log `/private/tmp/tracking-chat-arrow-build.log`; private publication log `/private/tmp/tracking-chat-arrow-publish.log`. Compiled on the Mac using Xcode 26.6 and iOS 26.5 components. No cloud quota, OTA, store submission or backend deployment; backend/PWA source unchanged for this release.

Exact verification and release commands from this directory:

```sh
pnpm exec tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/messages.spec.ts
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-14T19-21-33-834Z-1b0ca03a/tracking.so.ipa 20
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-14T19-21-33-834Z-1b0ca03a/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-14T19-26-18-016Z-fe2ee70a/distribution.json
```

## Previous release — build 19, September 14, 2026

- **Local production build 19 is complete, verified and hosted**, version 1.0.0. It restores the PWA post-log difficulty and metrics layouts, spring/fade entrances, pulsing check-in indicators, selected effort/reflection flow and compact Skip/Done actions. Note fields remain visible with the keyboard open and have a working keyboard Done bar. Build-17 annual Wrapped/search and prior photo/glass fixes are retained.
- IPA: `.release/2026-09-14T17-46-31-084Z-9ca81eca/tracking.so.ipa`; `verified.json` and `parity-markers.json` are beside it. SHA-256: `221fe07022c7801819cc0514d43114939c9b896fdfe19e1471499411bd6b454f`.
- Installer metadata and signed URL: `.release/2026-09-14T17-51-07-982Z-a2c82dd5/distribution.json`. Links expire **September 21, 2026, 17:51:15 UTC**. Republish this exact verified IPA to renew them without recompiling.
- The actual IPA passed production API/live Clerk, fixture-disabled, bundled JS, strict release signature, registered iPhone provisioning and entitlement checks. Feature markers include both follow-up drawers, reflection reasons and the final keyboard toolbar. The profile expires September 10, 2027.
- Installer, manifest and full IPA returned HTTP 200. The hosted IPA is 24,407,756 bytes and its SHA-256 matches the local artifact. Both installer themes passed mobile-width/Install-button checks and were visually inspected; evidence is in `browser-check.json` and `installer-light.png` / `installer-dark.png` beside distribution metadata. Physical installation remains for the user to confirm.
- TypeScript and nine browser E2E cases passed, covering save/retry, no duplicate metric entries, partial-close saving, Reduce Motion and logging regressions. Full native iOS DARK and LIGHT follow-up flows passed with exact persisted note/rating assertions. See Post-log follow-up drawer validation below and [the reference notes](../../docs/native-logging-follow-ups.md).
- Build log `/private/tmp/tracking-followups-build-final.log`; private publication log `/private/tmp/tracking-followups-publish.log`. Compiled on the Mac using Xcode 26.6 and iOS 26.5 components; no cloud quota, OTA or store submission. No backend deployment was needed for this change.
- Build 18 was an unpublished intermediate artifact without the final keyboard correction. Do not publish it as this release.

Exact release commands from this directory:

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-14T17-46-31-084Z-9ca81eca/tracking.so.ipa 19
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-14T17-46-31-084Z-9ca81eca/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-14T17-51-07-982Z-a2c82dd5/distribution.json
```

## Previous release — build 17, September 14, 2026

- **Local production build 17 is complete, verified and hosted**, version 1.0.0. It adds name/typo search with selectable results and persistent Back navigation, and corrects Wrapped to annual 2025 totals throughout. The previous glass/photo/reveal fixes are retained. Build 16's lifetime ranking is superseded.
- IPA: `.release/2026-09-14T16-35-01-071Z-0e75eb5d/tracking.so.ipa`. Reports: `verified.json` and `parity-markers.json` beside it. SHA-256: `e300506ff9b54f34cda018f77494b8a9e179e3069bd78908fa6f4e1216e845bc`.
- Installer metadata and signed URL: `.release/2026-09-14T16-40-10-724Z-a9b25cb0/distribution.json`. Hosted links expire **September 21, 2026, 16:40:18 UTC**. Republish this exact verified IPA to renew them without rebuilding.
- Production API/live Clerk, fixture-disabled configuration, bundled JavaScript and feature markers, strict release signature, registered iPhone provisioning and entitlements passed. The provisioning profile expires September 10, 2027.
- Installer and manifest returned HTTP 200; the entire hosted IPA (24,402,565 bytes) returned 200 and matches the local SHA-256. Both installer themes were inspected at iPhone width and passed Install-button/overflow checks. Evidence: `browser-check.json`, `installer-light.png` and `installer-dark.png` beside distribution metadata. Physical installation remains for the user to confirm.
- Backend annual aggregates and fuzzy accepted-connection search are deployed. Production read-only verification found @liocas has 345 eligible 2025 activities plus dated 25/100-point awards, totaling 470 points. Scope, UTC year boundaries, historical-data limits and deployment/rollback commands are in [the backend/search runbook](../../docs/wrapped-2025-search.md). The backend source remains uncommitted and must be included in the next normal source deployment.
- Both TypeScript checks, seven backend tests, four Wrapped model tests and eight browser E2E cases passed. Native iOS DARK and LIGHT search/keyboard/profile/back/empty results and annual Wrapped/share flows passed; see Annual Wrapped / people search validation below.
- Build log `/private/tmp/tracking-year-search-build.log`; private publication log `/private/tmp/tracking-year-search-publish.log`. Compiled locally using Xcode 26.6 and iOS 26.5 components; no cloud build quota, OTA or store submission.

Exact release commands from this directory:

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-14T16-35-01-071Z-0e75eb5d/tracking.so.ipa 17
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-14T16-35-01-071Z-0e75eb5d/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-14T16-40-10-724Z-a9b25cb0/distribution.json
```

## Previous release — build 16, September 14, 2026

- **Local production build 16 is complete, verified and hosted**, version 1.0.0. It fixes native glass reactions after reveals, restores the PWA photo-proof layout and upload flow, uses complete account totals for Wrapped rankings, and restores story/podium/ranking animations with Reduce Motion support. Rankings are explicitly all-time; no year-only point calculation is claimed. The backend and PWA were unchanged.
- IPA: `.release/2026-09-14T13-13-34-607Z-e35f7806/tracking.so.ipa`. Reports: `verified.json` and `parity-markers.json` beside it. SHA-256: `15ada7fd6dc1fa1f71e10619d1be36b37c55db949f91c6e3ffc2a871b3b7dbbc`.
- Installer metadata and signed URL: `.release/2026-09-14T13-19-32-109Z-f413bd83/distribution.json`. Hosted links expire **September 21, 2026, 13:19:39 UTC**. Republish this exact verified IPA to renew them without rebuilding.
- Production API/live Clerk, fixture-disabled configuration, release signature, registered iPhone provisioning, profile expiry, bundled JavaScript and entitlements passed verification. New photo/Wrapped and retained feature markers are present in the actual IPA.
- The installer, manifest and complete IPA returned HTTP 200. The full hosted IPA hash matches the local artifact. Both installer themes passed mobile-width/Install-button checks; evidence is in `browser-check.json` and `installer-light.png` / `installer-dark.png` beside distribution metadata. **Physical installation remains for the user to confirm.**
- Final validation: TypeScript, four Wrapped model tests, seven photo/Wrapped browser cases, nine logger/reaction regression cases, plus native logging, glass/viewers and Wrapped flows in DARK and LIGHT. See the verification section below for exact commands, limits and evidence.
- Build log: `/private/tmp/tracking-photo-glass-wrapped-build.log`. Private publication log: `/private/tmp/tracking-photo-glass-wrapped-publish.log`. Compiled on the Mac using Xcode 26.6 and iOS 26.5 components; no Expo cloud quota, OTA or store submission used.

Exact release verification/publication commands, from this directory:

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-parity-ipa.py .release/2026-09-14T13-13-34-607Z-e35f7806/tracking.so.ipa 16
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-14T13-13-34-607Z-e35f7806/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-14T13-19-32-109Z-f413bd83/distribution.json
```

## Previous release — build 15

- **Local build 15 is complete and hosted.** Version 1.0.0, compiled locally on Xcode 26.6 (17F113) with iOS 26.5 components. It restores the original logging drawer's centered title/emoji, inline calendar, compact time editor, quantity presets and content-sized sheet; fixes keyboard sizing; and retains selected friends across Back/Next. Build-14 reveals/Plans/Metrics polish and earlier features are retained. No Expo cloud quota was consumed.
- IPA: `.release/2026-09-14T12-26-32-329Z-998f7de6/tracking.so.ipa`; verification report beside it in `verified.json`, bundled feature checks in `logger-markers.json`.
- Installation metadata, signed URL, manifest, browser check and light/dark screenshots: `.release/2026-09-14T12-32-16-720Z-6987ef86/`. Read `distribution.json` for the actual URL; never commit signed links.
- Hosted links expire September 21, 2026 at approximately 12:32 UTC. Use `build:iphone:publish` with this same verified IPA to renew links without rebuilding.
- The actual IPA passed production API/live Clerk, fixture-disabled, release signature, bundled JavaScript, registered iPhone, profile expiry and HealthKit/AppGroup checks. Logger/calendar/keypad markers are present, alongside retained Plans/Metrics/Home/Wrapped markers.
- All three signed downloads returned success. The full hosted IPA SHA-256 matches the local verified artifact (`e12823557320a6dfa9a5dd63cbba274c4d1168df7392d0b54b3c56b97437a860`). The installer was inspected at iPhone width in both themes, with the matching build-15 manifest and native install scheme. **Physical installation of build 15 remains for the user to confirm.**
- TypeScript and three browser E2E cases passed, including presets, date/time retention, friend retention, API payload and the timeline/profile logging regression. Full native iOS 26.5 DARK and LIGHT logging flows passed. A final light status-bar/dismissal check passed; screenshots were inspected. See Activity logger validation below for exact commands and evidence paths.
- Build log `/private/tmp/tracking-logger-production-build.log`; publication log `/private/tmp/tracking-logger-publish.log` contains a signed URL and must remain private. Expo Doctor's existing SDK patch-alignment recommendation is nonfatal; tested dependencies were retained.
- AWS account `854257060653` / IAM user `alex` and its ownership of the existing installer bucket were confirmed with read-only STS/ListBuckets checks after automatic approval review requested ownership evidence. All four public-access block flags remain enabled. The same upload was then approved; no policy changes were made.
- Build 14 is the previous hosted release. Build 13 added Wrapped/streak/Home; 12 added reactions; 11 was the first successful local release. Do not present these older artifacts as containing the logger fix.
- One-time Xcode setup required `xcodebuild -downloadPlatform iOS` and restarting stale `ibtoold` services after upgrading. The wrapper compiles an Expo asset catalog before requesting an EAS build to catch missing/stale iOS runtime setup early.
- AWS CLI profile `default` works with the private build bucket. The old backend `.env` key is invalid; `codex-admin` needs reauthentication. Production media permissions were not changed.
- EAS free iOS cloud quota was reported exhausted until October 1; no paid plan was purchased or cloud build used for this release.
- The global preference is installed in `~/.codex/AGENTS.md`, and both tracking.so and verycheapaudiobooks have BUILDING.md/AGENTS.md guidance. The other app's release command/verification still needs adaptation when a build is requested there; no verycheapaudiobooks binary was produced by this task.
- EAS Update is **not configured**. This workflow installs full native builds; no OTA/store submission was performed.


## References

- [Expo local EAS builds](https://docs.expo.dev/build-reference/local-builds/)
- [Apple's over-the-air installation export](https://help.apple.com/xcode/mac/current/en.lproj/dev23ea8b877.html)
- [Expo internal/ad hoc distribution](https://docs.expo.dev/build/internal-distribution/)

## Other apps

The global preference is installed in `~/.codex/AGENTS.md`, and both repositories now have BUILDING.md guidance. Each app keeps its own identity and executable configuration. See the prepared [global rule](../../docs/local-ios-global-rule.md) and [verycheapaudiobooks handoff](../../docs/verycheapaudiobooks-building.md). Do not copy tracking.so's hardcoded verifier, Clerk key, HealthKit entitlements, bucket or bundle identity into another app.

## Wrapped / badge / Home validation

Run the isolated browser fixtures with `pnpm exec playwright test e2e/wrapped.spec.ts`; model checks are `node --import tsx --test tests/wrapped.test.ts`. The native flow is `node e2e/native/run.cjs --ios --wrapped`, using `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, `MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro` , `E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5` (iOS 26.5) and `E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app` on this Mac.

After adding native dependencies, regenerate the fixture simulator binary before running the native flow:

```sh
EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -quiet -workspace ios/trackingso.xcworkspace -scheme trackingso -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/tracking-wrapped-simulator CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=7P4CMS849D build
```

Keep simulator signing enabled: an unsigned app lacked simulated Keychain entitlements and caused expo-notifications to fail. This binary is fixture-only; it is never distributed. The release wrapper separately generates a clean native project with production settings. Do not run simultaneous Metro exports and fixture servers against the same project.

Run the wrapped native flow twice with `E2E_THEME=DARK` and `E2E_THEME=LIGHT`; the runner seeds the chosen theme before launching, so cached Home queries cannot miss the fixture data. The iOS 26.5 simulator above is the validated runtime and includes working emoji fonts. Retain the YAML screenshot-settling waits: taps immediately after capture were unreliable in Maestro, while direct taps and settled single-tap runs passed.

## Plans / Metrics polish validation

Browser: `pnpm exec playwright test e2e/polish.spec.ts`. Models: `node --import tsx --test tests/metric-correlations.test.ts`. TypeScript: `pnpm exec tsc --noEmit`.

Native: use the same fixture simulator app and environment documented above, with `node e2e/native/run.cjs --ios --polish` and separate `E2E_THEME=DARK` / `E2E_THEME=LIGHT` runs. The runner seeds `/__polish` before the app starts caching data and verifies notes remain unchanged after cancellation. This change adds no native dependencies, so the already signed fixture simulator app can load the new JS through the local test Metro server. Do not use it as an iPhone release.

The native tab bar minimizes after scrolling. In the test flow, tap the currently selected tab to expand it before choosing another tab. Notes preview may put Cancel below the fold; scroll it into view. Keep screenshot-settling waits and the explicit native tap settling values. Final evidence: `test-results-native-ios/2026-09-14_100537/polish-ios/` and `test-results-native-ios/2026-09-14_100713/polish-ios/`.

## Activity logger validation

The logger follows Vite's `ActivityLoggerPopover` calendar/quantity layout and keeps the native upload/shared/difficulty/metrics flow. It has a content-sized bottom drawer, safe close control, keyboard resizing, number-pad Done accessory and native time wheels. Light-mode status-bar contrast is restored correctly after dismissal.

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@playwright/test/cli.js test e2e/logger.spec.ts e2e/parity.spec.ts -g 'logging drawer|logs activity'
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
E2E_THEME=DARK \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
node e2e/native/run.cjs --ios --logger
```

Repeat the native command with `E2E_THEME=LIGHT`; `--logger-appearance` checks the light status bar and its restoration on close. Native full flows passed September 14 in DARK (`test-results-native-ios/2026-09-14_132334/logger-ios`) and LIGHT (`2026-09-14_132444/logger-ios`). The final light appearance check passed in `2026-09-14_132617/logger-appearance-ios`. Screenshots were inspected. Tests use fixture services, never production user-data writes. The friend-search fixture matches the backend's `userId` response field.


Build-15 commands (from `apps/frontend-expo`):

```sh
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' node --import tsx scripts/iphone/cli.ts build
python3 .release/check-logger-ipa.py .release/2026-09-14T12-26-32-329Z-998f7de6/tracking.so.ipa
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish .release/2026-09-14T12-26-32-329Z-998f7de6/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-14T12-32-16-720Z-6987ef86/distribution.json
```

The last two `.release` helpers are local verification utilities. The hosted check verifies both installer themes, the actual manifest identity and the complete hosted IPA checksum without printing signed URLs. Use the new artifact/output paths for subsequent releases.

## Photo proof / reaction glass / Wrapped verification

The photo step follows Vite's `ActivityPhotoUploader` and `MultiPhotoUploader`: proof heading, upload tile, ten-photo limit, removable previews, caption, seven-day visibility notice and one upload/skip-photo action. Native source selection uses the iOS photo/camera action sheet. Additional native logging options remain under More options. Failed uploads preserve the caption and photos.

UIKit glass should mount only after an ancestor reveal's opacity animation finishes. `RevealSettledContext` gates the reaction `GlassView`; otherwise iOS may permanently render only the outline after an initially transparent mount. Verify emoji, neutral frost, selected accent and reaction viewers on **iOS 26.5**, in both themes.

Build 16 used complete lifetime `accountStats` to avoid the 40-entry profile preview. **That scoring is superseded by build 17:** Wrapped must request `/users/wrapped?year=2025` and use annual values, with no preview or lifetime fallback. See Annual Wrapped / people search validation below. Story transitions, spring podiums and staggered ranking rows still respect Reduce Motion; sharing waits for reveals to finish.

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/wrapped.test.ts
node node_modules/@playwright/test/cli.js test e2e/photo-proof.spec.ts e2e/wrapped.spec.ts
node node_modules/@playwright/test/cli.js test e2e/logger.spec.ts e2e/parity.spec.ts e2e/reaction-people.spec.ts -g 'logging drawer|logs activity|reaction viewers'
```

Using the native simulator environment documented above, run `node e2e/native/run.cjs --ios --logger`, `--reaction-glass` and `--wrapped`, each with `E2E_THEME=DARK` and `LIGHT`. Photo tests verify ten selections, removal, multipart image bytes and recovery after an upload failure. Native logger checks the photo-source menu, caption keyboard, cancellation and completion. Browser upload tests use fixture images; simulator checks never write activities to production. Keep a settling wait after every Maestro screenshot before tapping a story control.

Before hosting a subsequent build, run the local marker utility with the **actual** new build number:

```sh
python3 .release/check-parity-ipa.py /absolute/path/to/new/tracking.so.ipa ACTUAL_BUILD_NUMBER
AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish /absolute/path/to/new/tracking.so.ipa
node .release/verify-hosted.cjs /absolute/path/to/new/distribution.json
```

The ignored local utility verifies new photo, Wrapped and retained feature markers against the verified IPA hash and Info.plist build number. The host utility downloads the entire IPA and checks its hash, manifest and both installer themes. These utilities must not print credentials or commit signed URLs.

September 14 validation evidence for the photo/glass/Wrapped fixes:

- TypeScript and all four Wrapped model tests passed. The complete-totals regression covers a 40-entry preview, authoritative points, complete activity-count fallback and explicit zero points.
- Final browser photo/Wrapped suite: 7 passed (`/private/tmp/tracking-final-browser.log`). Earlier logger/reaction regression suite: 9 passed (`/private/tmp/tracking-proof-glass-browser.log`). Screenshots are in `test-results/`.
- Native photo/logging: DARK `test-results-native-ios/2026-09-14_140657/logger-ios/`, LIGHT `2026-09-14_140824/logger-ios/`.
- Native glass/viewers: DARK `2026-09-14_134855/reaction-glass-ios/`, LIGHT `2026-09-14_140924/reaction-glass-ios/`. The pre-fix native capture is `2026-09-14_134749/reaction-glass-ios/`.
- Final native Wrapped stories, full ranking totals, badge drawer, Home retap and native share sheet: DARK `2026-09-14_141255/wrapped-ios/`, LIGHT `2026-09-14_141502/wrapped-ios/`. Both passed. The first dark run exposed a missing Maestro settle after the newly added ranking screenshot; the corrected flow passed in both themes. This was not bypassed by removing the streak assertion.
- Native light/dark photo and glass captures, browser selected-photo previews, and final native ranking captures were inspected. No production activity writes were used for these tests; no exact production friend's new score is claimed from fixture evidence.


## Annual Wrapped / people search validation — build 17

From the repository root:

```sh
pnpm --filter backend-node exec tsc --noEmit
pnpm --filter backend-node exec vitest run src/services/wrapped/model.test.ts src/services/wrapped/service.test.ts src/services/people/rank.test.ts
pnpm --filter frontend-expo exec tsc --noEmit
```

From this frontend directory:

```sh
node --import tsx --test tests/wrapped.test.ts
node node_modules/@playwright/test/cli.js test e2e/wrapped.spec.ts e2e/people-search.spec.ts
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=DARK node e2e/native/run.cjs --ios --year-search
```

Repeat with `E2E_THEME=LIGHT`. Both passed: DARK `test-results-native-ios/2026-09-14_173053/year-search-ios/`, LIGHT `test-results-native-ios/2026-09-14_173356/year-search-ios/`. Search and annual ranking screenshots were inspected. Native logs are `/private/tmp/tracking-year-search-native-DARK.log` and `...-LIGHT.log`; browser log `/private/tmp/tracking-year-search-browser.log` (8 passed). Backend unit log `/private/tmp/tracking-year-search-unit.log` (7 passed). Four Wrapped model tests also passed.

Tests cover names/typos, profile Back with query retention, keyboard and empty results; browser cases additionally cover unavailable search and missing-profile Back. Annual fixtures intentionally differ from both the capped preview and lifetime totals. They check 470 annual points, annual streaks and awards, story navigation, reduced motion, error handling and native sharing. Fixtures never write production data. The production count was separately verified inside an explicit READ ONLY database transaction; see the backend runbook. No native dependencies changed, so the existing signed fixture simulator app was reused with current JS, while the distributed IPA was compiled separately with production configuration.

## Post-log follow-up drawer validation

The difficulty and metric follow-ups now match the PWA layout and motion. See [the implementation/reference notes](../../docs/native-logging-follow-ups.md) for the source components, measurements, animation timings and save behavior. No backend or PWA source was changed for these drawers.

```sh
node node_modules/typescript/bin/tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/follow-ups.spec.ts e2e/logger.spec.ts e2e/parity.spec.ts -g 'post-log effort|Reduce Motion|logging drawer|logs activity|metric|partial check-in'
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=DARK node e2e/native/run.cjs --ios --follow-ups
```

Repeat with `E2E_THEME=LIGHT`. Final TypeScript and all nine browser cases passed (`/private/tmp/tracking-followups-types.log`, `/private/tmp/tracking-followups-browser-final.log`). Native iOS DARK passed in `test-results-native-ios/2026-09-14_184511/follow-ups-ios/`; LIGHT passed in `2026-09-14_184714/follow-ups-ios/`. Logs: `/private/tmp/tracking-followups-native-DARK-final.log` and `...-LIGHT-final.log`. The native runner verifies exact reflection text, difficulty, three metric writes and the daily note. Dark/light drawer screenshots and light keyboard captures were inspected.

Native testing caught a real keyboard issue: a focused reflection could be clipped after the drawer shrank, and the input accessory did not appear for the multiline field. The final implementation scrolls the follow-up content when its keyboard layout changes and uses a fixed Done bar above the keyboard. The tests verify visible focused fields and exact saved text. Keep escaped question marks in Maestro selectors and screenshot-settling waits.

Build 18 (`.release/2026-09-14T17-41-19-969Z-d3c07d6e/tracking.so.ipa`) was compiled before this final keyboard correction. It was **not uploaded** and must not be offered as the completed drawer fix. The following build includes the correction; consult Current status above for the verified hosted release. No Expo cloud quota was used for either compilation.

## Activity editor parity — included in build 29

The edit/add activity drawer now follows the PWA layout, stepped color palette and separate measure/delete confirmations. [Comparison and exact checks](../../docs/native-activity-editor.md) include the reference renders, six browser scenarios and native DARK/LIGHT keyboard/conversion flows. The current simulator development bundle was reused with new JavaScript; no native dependency changed. This drawer update is exported, verified and hosted in build 29; build 26 lacks it.

## Workout matching hierarchy — included in build 30

The workout review now has one primary commit action, editable match/amount summary rows, focused choice views and a quiet Skip. The independent PWA/native design comparison supported four concise AGENTS.md rules. TypeScript, eight Health browser cases and native DARK/LIGHT checks passed, including create-input keyboard handling. See [Health validation notes](../../docs/native-health-v0.md#workout-drawer-hierarchy-follow-up--september-15-after-build-29) for evidence and reproduction commands. This source change is included in verified and hosted build 30; build 29 does not contain it. No OTA was published.
