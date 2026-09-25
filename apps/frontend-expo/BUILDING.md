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

## Packaging rule: always build with the root `.easignore`

EAS uses `.easignore` when present and otherwise falls back to `.gitignore`. `apps/frontend-expo/.gitignore` used to ignore `ios/` everywhere, which also removed `modules/*/ios` (the TrackingWatch, TrackingHealth and TrackingMap Swift sources). A preserved release source without the root `.easignore` therefore built an app with none of our native modules, and it aborted 0.5 s after launch with `Cannot find native module 'TrackingWatch'`. Builds 162 and 164 were packaged this way; 165 is not. The ignore rule is now `/ios/`. Before uploading, check the build's `ios/Podfile.lock` lists `TrackingWatch`, `TrackingHealth` and `TrackingMap`.

## Current TestFlight release — build 166, September 25, 2026

- Build 165's source plus the homepage plan state (green ring on track, pulsing amber ring + warning icon when slipping), the coach's silent nudge with "Remind me tomorrow" / "Let it go", and plan emoji in the Messages filter pills. Requires backend `plan-nudges-20260925` (live).
- IPA: `.release/testflight-plan-nudges-b166/tracking.so.ipa` (SHA-256 `9c64a1a2437ce0ba8ec2acd5b130f2ecd5c52b769db9a1bdb7a6da62f1b9106f`), `source.tar.gz` beside it. Phone and Watch 1.0.0 build 166; TrackingWatch/Health/Map modules registered; strict signature and production configuration verified; new strings present in the bundle.
- Apple validation passed; delivery `e739e75b-fcb5-4989-a471-a37d4ff26ea2` processed as `VALID`; internal testers only.

## Previous TestFlight release — build 165, September 25, 2026

- Same source as build 164 plus the root `.easignore`, so the TrackingWatch, TrackingHealth and TrackingMap native modules are linked again (Podfile.lock lists all three; ExpoModulesProvider registers them; the main binary grew from 21,822,944 to 22,012,624 bytes). Phone and Watch are 1.0.0 build 165; strict signature and production configuration verified.
- IPA: `.release/testflight-coach-garmin-b165/tracking.so.ipa` (SHA-256 `c1f40c62d5d7fbbfa98f9e550bc0345166f4b9adbab4654afbb53b43279082ae`), `source.tar.gz` beside it (includes the module Swift sources).
- Apple validation passed; upload delivery `944f7c46-93ea-4aaa-9e0e-2548ef7c05cf` processed as `VALID`; `IN_BETA_TESTING` for `internal testers`. Not submitted to Friends & Family.
- Build 164 crashed 0.55 s after launch (`Cannot find native module 'TrackingWatch'`) and was expired in TestFlight on September 25.

## Withdrawn — build 164, September 24, 2026

- Build 164 was compiled locally from build 162's exact source (`.release/testflight-heart-rate-b162/source.tar.gz`, which added the thicker colored heart-rate chart on top of build 156's source) with only the coach-role and Garmin webhook-only app changes three-way merged in, so testers keep everything 162 had. Onboarding asks for a starting point and motivation again; the plan page groups Coach/Coaching like Schedule/Reminders; proposed sessions show as date cards; the Garmin screen drops "Sync now" and the Garmin-support email flow.
- App Store IPA: `.release/testflight-coach-garmin-b164/tracking.so.ipa` (SHA-256 `057e9ae4487f3582147f3ea11bdfe1749270d9dbe8372bf94da926aee4159d32`), with `source.tar.gz` beside it. iPhone and Watch are 1.0.0 build 164; strict signature, production API/live Clerk and fixture exclusion verified, and the new strings are present in the Hermes bundle.
- Apple's validator passed; upload delivery `d264f955-592d-42d7-99e6-4147a8f93ae5` processed as `VALID`. Internal state `IN_BETA_TESTING` for the `internal testers` group (access to all builds, auto-notify). Not submitted to Friends & Family.
- Requires backend `coach-garmin-20260924` (hetzner/MIGRATION.md), live since September 24. Build 163 (coach-only) was built and validated but never uploaded. Builds 161/162 are recorded in the original checkout's uncommitted notes.

## TestFlight distribution — build 160, September 23, 2026

TestFlight uses a separate App Store distribution profile and does not use the Safari-install/ad hoc workflow above. The App Store Connect app is `6754610882`, the iPhone bundle is `so.tracking.app`, and the Watch companion is `so.tracking.app.watchkitapp`.

- **Build 160 (version 1.0.0) is the current TestFlight release.** It was built locally from deployed commit `f74c2815` with the iPhone and Watch targets, production API and live Clerk configuration, bundled JavaScript, and fixture mode disabled. The exact store-signed IPA is `.release/testflight-2026-09-23T01-24-37-221Z/tracking.so.ipa`; its SHA-256 is `55b8e2e410bfadc3ab6f3a619273e39c6f67d7979b727f1563ad9a803891099e`. The local verification record is alongside it at `verification.json`. Apple’s archive validator returned `VERIFY SUCCEEDED`, the upload delivery ID is `888378a9-992b-41f1-af6d-053944050bb7`, and App Store Connect reports `processingState: VALID`, `usesNonExemptEncryption: false`, and both internal and external states `IN_BETA_TESTING`.
- Apple approved build 160 for external beta review. The `Friends & Family` group has build 160 attached, feedback enabled, and its public link **disabled**. It has five email-invited testers after four more were added on September 23; all five records currently show `INVITED` until the recipients accept. The internal group contains one of these testers and receives processed builds automatically. Physical installation has not been verified.
- Earlier TestFlight builds 70 and 78 remain in App Store Connect. Build 78’s beta review is `APPROVED`.
- The App Store Connect API key is stored locally at `.release/appstore-connect/AuthKey_RRBPAL9WF4.p8` with mode `600`. `.release/` is ignored by `apps/frontend-expo/.gitignore`; never commit the key or copy its contents into tracked files. `eas.json` stores only the App Store app ID, key ID and issuer ID.
- The direct Apple uploader is `scripts/iphone/testflight.ts`. It reads `.release/production.env.json` for local builds, removes inherited `SDKROOT` when necessary, uses `/Applications/Xcode.app`, and never starts an Expo cloud build.

From this directory, repeat the workflow with:

```sh
pnpm build:testflight
pnpm validate:testflight .release/testflight-YYYY-MM-DDTHH-MM-SS-sssZ/tracking.so.ipa
pnpm submit:testflight .release/testflight-YYYY-MM-DDTHH-MM-SS-sssZ/tracking.so.ipa
```

The build command creates a new remote build number and writes a store-signed IPA under `.release/`. Validate the exact output before submitting it. `submit:testflight` uploads directly with Apple’s Xcode 26.6 `altool` and waits for `VALID`. Pass the IPA path directly to the package scripts; adding a literal `--` forwards it as a path and fails validation. TestFlight group access, review status and invitations are managed in [App Store Connect TestFlight](https://appstoreconnect.apple.com/teams/f2738712-afe4-496a-8317-a78e28ed722c/apps/6754610882/testflight).

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

## Current status — build 159 verified and hosted, September 23, 2026

Feature source commit `4320328d2ad47bcdffdc1a276a6627f5119f92bf` is on `origin/main`. This local production build adds offline activity logging and cached timeline browsing, heart-rate zone shading, timed kilometre splits, and delayed-photo notifications. It preserves runtime fixes already shipped in build 156, including notification navigation, workout privacy and image exports. Original uncommitted work remains in the original checkout.

The publisher successfully GET-verified the exact IPA, manifest and HTTPS installer. The private installer record is `.release/2026-09-23T01-04-43-051Z-e1c492ae/distribution.json`; its link expires September 30, 2026 at 01:05:30 UTC. Signed URLs remain in ignored files. No cloud quota, OTA or store submission was used.

The IPA is `tracking-main-delivery/apps/frontend-expo/.release/2026-09-23T00-59-37-935Z-882a783c/tracking.so.ipa` relative to the workspace wrapper. SHA-256: `eef11415ea06bfbbc80d3c5a9a0fcc8f96fba77a198961d502cafbd4b4ceb45a`. The adjacent `verified.json` records build 159 for both iPhone and Watch and provisioning expiry September 10, 2027. Verification checked production API/live Clerk, fixture authentication disabled, bundled JavaScript, strict release signatures, app identity and registered phone/Watch provisioning. Installation on the user's devices is not claimed. Builds 157/158 were unsuccessful or stopped and were not published.

The exact local build command, from `tracking-main-delivery/apps/frontend-expo`, was:

```sh
PATH=/private/tmp/tracking-pnpm-bin:$PATH \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
AWS_PROFILE=default \
IPHONE_ENV_FILE=/Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/.release/production.env.json \
IPHONE_WATCH_DEVICE_FILE=/Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/.release/watch-device.json \
EAS_LOCAL_BUILD_SKIP_CLEANUP=1 \
EAS_LOCAL_BUILD_WORKINGDIR=/private/tmp/tracking-four-feature-final-build \
node --import tsx scripts/iphone/cli.ts build
```

The temporary pnpm launcher supplies the repository's pnpm 10 version. Build log: `/private/tmp/tracking-four-feature-final-build.log`. To re-verify and publish this exact IPA, use the same existing environment and Watch metadata files:

```sh
AWS_PROFILE=default \
IPHONE_ENV_FILE=/Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/.release/production.env.json \
IPHONE_WATCH_DEVICE_FILE=/Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/.release/watch-device.json \
node --import tsx scripts/iphone/cli.ts publish \
  /Users/alramalho/workspace/tracking.so/tracking-main-delivery/apps/frontend-expo/.release/2026-09-23T00-59-37-935Z-882a783c/tracking.so.ipa
```

Independent acceptance included six native graph flows across LIGHT/DARK, cached timeline/log/restart/reconnect in both themes, and a native Photos picker flow proving the staged photo survives restart and uploads once after a lost response. Latest-workout native before/after screenshots were inspected. Backend verification used an isolated PostgreSQL database: 48 photo route/delivery/unit cases plus offline receipt concurrency checks. No production test records or pushes were created. Real Clerk offline cold-start and physical provider import/APNs delivery remain device confirmation. Historical workouts without timed distance samples correctly show splits unavailable.

Photo notification eligibility uses activity completion (`endedAt`, otherwise entry `datetime`), within 12 hours and on the same local day as the photo upload. Durable upload timestamps preserve eligibility during delayed retries. The backend image `local/tracking-so-backend:four-features-4320328d` and four additive migrations are live; public `/health` and deployed source hashes passed. See the backend runbook for activation and rollback.

## Previous status — build 156 verified and hosted, September 23, 2026

- **Fresh local production build 156 is complete, verified and hosted**, version 1.0.0. It adds native notification destinations: activity reactions/comments and achievement notices open highlighted timeline cards; chat, plan and profile notices open their corresponding screens; daily summaries and older pushes without a URL open Notifications. The in-app notification list has an Open action. The backend push URL and iOS-only eligibility changes are deployed as `local/tracking-so-backend:notification-navigation-b156`, a three-file overlay on `reactions-60f9f92e-workout-privacy`. The backend container and public `/health` endpoint passed after activation. No schema migration was needed.
- IPA and verification report: `.release/2026-09-23T00-31-32-556Z-1df5d7fe/tracking.so.ipa` and `verified.json`. IPA SHA-256: `64a350e3623144800fafb6ef6c4314268b3bbefb69fff09324577d61f7dffcb2`; phone and Watch build numbers are both 156. Their embedded profiles provision the registered devices and expire September 10, 2027. Apple's read-only credential check confirmed the existing certificate and both profiles remain active. The Hermes bundle contains the notification target code, and the verified app configuration uses production services.
- The ignored release directory also preserves `source.tar.gz`, the exact isolated EAS source archive (SHA-256 `0b7373ecce52d3dfcdf07449997e253ac0063016a458aaf8d027b9c99ada0563`). It was made from build 152's preserved EAS source with only the notification app files updated; this avoided unrelated in-progress checkout edits. `distribution.json` holds the expiring signed link, which is not written into tracked docs. Light/dark Safari-size installer checks, the manifest, and the complete 26,294,630-byte hosted IPA all returned HTTP 200; the downloaded SHA-256 matched the local IPA. The link expires September 30, 2026, at 00:32:17 UTC.
- The first isolated local attempt failed before compilation because EAS treated the app folder as the workspace root. Setting `EAS_PROJECT_ROOT` to the isolated monorepo root fixed dependency installation. The successful build archived and signed the IPA, but the wrapper stopped before publication because that isolated directory lacked `.release/watch-device.json`. After copying the existing device record, `build:iphone:publish` verified and hosted **that same IPA** without rebuilding. No Expo cloud build quota, OTA publication or App Store submission was used.

Exact build, verification and hosting commands used (the isolated source and exact outputs are preserved in the ignored release directory):

```sh
cd /private/tmp/tracking-notification-release-source/project
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter frontend-expo typecheck
pnpm --filter frontend-expo build:iphone:check
AWS_PROFILE=default EAS_NO_VCS=1 EAS_PROJECT_ROOT=/private/tmp/tracking-notification-release-source/project EAS_LOCAL_BUILD_SKIP_CLEANUP=1 EAS_LOCAL_BUILD_WORKINGDIR=/private/tmp/tracking-notification-build2 pnpm --filter frontend-expo build:iphone
cp -p /Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/.release/watch-device.json apps/frontend-expo/.release/watch-device.json
AWS_PROFILE=default pnpm --filter frontend-expo build:iphone:publish /private/tmp/tracking-notification-release-source/project/apps/frontend-expo/.release/2026-09-23T00-26-25-749Z-635190d1/tracking.so.ipa
cd /Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo
node .release/verify-hosted.cjs .release/2026-09-23T00-31-32-556Z-1df5d7fe/distribution.json
node .release/startup-signing-repair/verify.cjs
```

The backend rollback environment is `/root/workspace/tracking.so/deployment/.env.before-notification-navigation-b156` on the production host. Its deployment context is `tracking-notification-backend-overlay/`, which contains only the two existing notification services and the new destination helper. Restore that environment file and recreate only `backend` to return to `reactions-60f9f92e-workout-privacy` if necessary.

## Previous status — build 152 verified and hosted, September 23, 2026

- **Fresh local production build 152 is complete, verified and hosted**, version 1.0.0, with the matching Watch companion. EAS now selects an existing active distribution certificate and active phone/Watch profiles. Read-only Apple checks and inspection of the IPA's actual profiles confirm the certificate match and registered devices. No certificate was created or revoked by the startup-validation task.
- Build 152 includes the workout-share PNG fix: the measured card is captured without a scaled parent, and portrait/landscape layouts keep the route, all selected stats and the tracking.so watermark inside the canvas. Fixture-backed iOS exports passed for light/dark themes, 3/6 stats and portrait/landscape; the actual shared PNGs were checked for dimensions, margins, readable stats and visible branding. The browser layout checks cover both themes, both formats and narrow/wide widths. The EAS source allowlist includes `packages/prisma/reactions.ts`, which the current app bundle imports.
- IPA: `.release/2026-09-22T23-50-07-869Z-d4ea4d40/tracking.so.ipa`; SHA-256 `e529cb0901c1a66594a250e1a146f74b683913cedff7491f63183bed60e271bb`. Both app build numbers are 152; profiles expire September 10, 2027 at 15:25:21 UTC. The signed IPA passes strict signature, production API/live Clerk, fixture-disabled, bundled-JavaScript, entitlements and phone/Watch device-provisioning checks.
- Installer metadata is `distribution.json` beside the IPA. Links expire **September 29, 2026, 23:55:29 UTC**. Light/dark mobile browser checks passed with a valid `itms-services:` Install button and no overflow. The manifest and complete 26,293,481-byte hosted IPA returned HTTP 200; the downloaded SHA-256 matches the verified local IPA. Evidence: `browser-check.json` and `installer-light.png` / `installer-dark.png` beside the IPA.
- The refreshed production Release simulator app starts into onboarding and remains running. Evidence: `/private/tmp/tracking-startup-release-final.png`; build log `/private/tmp/tracking-startup-simulator-final.log`. Physical iPhone startup remains for the user to validate. TypeScript and all eight release/reaction tests passed.
- Build 153 failed before compilation because a shared local provisioning-profile file disappeared during concurrent EAS work; it produced no IPA. Build 152 was already compiling locally, completed successfully, and was independently verified for this request. **Serialize local device builds** to avoid profile cleanup collisions. Neither Expo cloud quota nor OTA/store distribution was used.

Successful build/hosting command used for build 152 (from this directory; the working-directory name is historical, not the actual build number):

```sh
PATH=/private/tmp/tracking-pnpm-bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer AWS_PROFILE=default EAS_LOCAL_BUILD_SKIP_CLEANUP=1 EAS_LOCAL_BUILD_WORKINGDIR=/private/tmp/tracking-share-build150 node --import tsx scripts/iphone/cli.ts release
node .release/startup-signing-repair/verify.cjs
node .release/verify-hosted.cjs .release/2026-09-22T23-50-07-869Z-d4ea4d40/distribution.json
```

The ignored `startup-signing-repair/verify.cjs` is a read-only EAS/Apple check. Reports there also record the independent IPA validation and active-certificate comparison. Signing verification needs macOS trust-service access; a sandbox-only `CSSMERR_TP_NOT_TRUSTED` must be rerun with that access, never bypassed. Signed URLs remain only in ignored release metadata.

If Xcode chooses a revoked identity despite EAS importing the active one, check `security list-keychains -d user` for stale temporary `eas-build-*` keychains. For this release, removing those stale keychains from the user search list with `security list-keychains -d user -s "$HOME/Library/Keychains/login.keychain-db"` left the existing valid identity available; the temporary keychain created by the next EAS run supplied its own signing identity. Do not delete the active certificate or weaken signature verification.

## Investigation — signing blocker resolved, September 23, 2026

- The user reports immediate exit at startup. Fresh local production build **147 failed at signing and produced no IPA or install link**. Xcode rejects the distribution certificate used by both phone and Watch as invalid/revoked. Apple's read-only certificate inventory no longer contains that certificate; the same certificate is embedded in build 145's provisioning profile. The profile's future expiration date does not make a revoked certificate valid.
- The user subsequently approved reuse of a valid existing certificate and matching profiles, without revocation. The EAS setup was found updated during verification and passed the read-only checks above. Preserve both registered devices in the Watch profile in any future repair.
- A fresh **Release simulator build** compiled with the production API/live Clerk configuration, fixture mode disabled, and bundled JavaScript (9,918,722 bytes). It launched successfully into onboarding and remained running. This does not validate physical-device signing or establish that every account-specific startup path works. Evidence: `/private/tmp/tracking-startup-release-20260923.png`; compiler log: `/private/tmp/tracking-startup-simulator-20260923.log`.
- Frontend TypeScript, all five release workflow tests, and `git diff --check` passed. No cloud build, OTA update, backend deployment or store submission was performed.

Exact checks and failed device-build command (from this directory):

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/iphone-release.test.ts
PATH=/private/tmp/tracking-pnpm-bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node --import tsx scripts/iphone/cli.ts check
PATH=/private/tmp/tracking-pnpm-bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts build > /private/tmp/tracking-startup-build-20260923.log 2>&1
```

The local pnpm shim selects the already installed pnpm executable. The default launcher currently fails its registry-backed version switch in the restricted environment. After approved signing repair, rerun the local build, publish its explicit new IPA path with `AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts publish /absolute/path/to/new.ipa`, and verify the hosted bytes before sharing a link.

Exact production simulator compilation and startup commands:

```sh
node --import tsx -e 'const {spawnSync}=require("node:child_process");const {buildEnvironment}=require("./scripts/iphone/configuration.ts");const result=spawnSync("xcodebuild",["-quiet","-workspace","ios/trackingso.xcworkspace","-scheme","trackingso","-configuration","Release","-destination","platform=iOS Simulator,id=1E390112-CE48-4DD6-B61B-431D00A8EA55","-derivedDataPath","/private/tmp/tracking-startup-release-simulator","CODE_SIGN_IDENTITY=-","DEVELOPMENT_TEAM=7P4CMS849D","build"],{env:buildEnvironment(),stdio:"inherit"});process.exit(result.status??1)' > /private/tmp/tracking-startup-simulator-20260923.log 2>&1
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl install 1E390112-CE48-4DD6-B61B-431D00A8EA55 /private/tmp/tracking-startup-release-simulator/Build/Products/Release-iphonesimulator/trackingso.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl launch --terminate-running-process 1E390112-CE48-4DD6-B61B-431D00A8EA55 so.tracking.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl io 1E390112-CE48-4DD6-B61B-431D00A8EA55 screenshot /private/tmp/tracking-startup-release-20260923.png
```

## Previous status — build 145, September 20, 2026

**September 23 correction:** this artifact used a certificate that is now revoked. Its previously successful local signature/hosting checks do not establish current iPhone installability or launchability. Do not return its link as a startup fix.

- **Local production build 145 is complete, verified and hosted**, version 1.0.0. It keeps the Tracking T icon/background watermark on portrait cards, anchors the landscape mark as a fixed bottom-right overlay inside the route/map area, and adds a small landscape route inset so both endpoint dots remain inside the exported canvas for 3- and 6-stat layouts.
- IPA: `.release/2026-09-20T11-25-47-050Z-fd136fc9/tracking.so.ipa`. SHA-256: `95c9d0cc7d2fa958c314bec38f1b403e94aaa4a4fc2bf7ebdb48f1bbd7d702c3`. Phone and embedded Watch companion are both build 145 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 20, 2027.
- Installer metadata: `.release/2026-09-20T11-25-47-050Z-fd136fc9/distribution.json`. Links expire **September 27, 2026, 11:29:57 UTC**. The capture requests the selected canvas width and height explicitly; the hosted installer page, manifest and IPA returned successfully.
- TypeScript, focused mobile-web share-card tests (light/dark) with canvas aspect-ratio, fixed map-overlay bounds and endpoint-marker-in-canvas assertions for both landscape stats counts, native release signing and `git diff --check` passed. No Expo cloud build quota, OTA publication, paid subscription or App Store submission was used.

Exact release command for this artifact:

```sh
cd apps/frontend-expo
PATH=/private/tmp/tracking-pnpm-bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer AWS_PROFILE=default node --import tsx scripts/iphone/cli.ts release
```

The signed install URL is intentionally not recorded in tracked documentation.

## Previous status — build 119, September 18, 2026

- **Local production build 119 is complete, verified and hosted**, version 1.0.0. It includes the Garmin rolling-history sync status, imported-history totals and explicit backfill outcomes in the Health UI.
- IPA: `.release/2026-09-18T14-01-06-360Z-b12856f6/tracking.so.ipa`. SHA-256: `f6a95ef6fd91b367b7b17412454877323a79d45d39b8424ded42544b5a255ea0`. Phone and embedded Watch companion are both build 119 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T14-01-06-360Z-b12856f6/distribution.json`. Links expire **September 25, 2026, 14:05:41 UTC**. The release workflow verified the signed IPA, manifest and installer upload before returning the install link.
- The backend is deployed separately as `local/tracking-so-backend:garmin-rolling-20260918`, with migration `20260918150000_add_garmin_backfill_queue` applied. The live Lia probe refreshed all five Garmin permissions, advanced the rolling cursor through four summary types, and still observed zero imported workouts because Garmin rejected each historical backfill window with HTTP 400; no synthetic workout records were inserted.

Exact release command for this artifact:

```sh
AWS_PROFILE=default pnpm --filter frontend-expo build:iphone
```

The signed install URL is intentionally not recorded in tracked documentation.

## Previous status — build 115, September 18, 2026

- **Local production build 115 is complete, verified and hosted**, version 1.0.0. It includes the final native-validated share-card landscape layout: the route/map is on the left and six stats are on the right in a 3 rows × 2 columns disposition. The landscape content group is explicitly centered vertically with balanced breathing room; portrait remains route-above/stats-below.
- Native Maestro Apple Watch vitals flow passed on iOS 26.5 simulator, including the share-card editor, six stats, Landscape selection, all six stat labels, watermark and final screenshot at `test-results-native-ios/2026-09-18_132922/health-vitals-ios/takeScreenshot/workout-share-landscape.png`. Frontend TypeScript and `git diff --check` passed.
- IPA: `.release/2026-09-18T12-30-57-551Z-79109607/tracking.so.ipa`. SHA-256: `4cf3988ba6754f9e29983407f935b361cd5cd1ae7f041100a3c6a5b5bb003c25`. Phone and embedded Watch companion are both build 115 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T12-30-57-551Z-79109607-publish/distribution.json`. Links expire **September 25, 2026, 12:35:34 UTC**. Hosted verification returned HTTP 200 for light/dark installer pages, manifest and IPA, confirmed `itms-services:` links, no horizontal overflow, and matched the hosted IPA SHA-256 to the local artifact. The signed URL is intentionally not recorded here.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T12-30-57-551Z-79109607/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T12-30-57-551Z-79109607-publish/distribution.json
```

## Previous status — build 111, September 18, 2026

- **Local production build 111 is complete, verified and hosted**, version 1.0.0. It includes the native-validated share-card landscape reflow: the route/map is placed beside the stats, with six stats arranged as 3 rows × 2 columns; portrait remains route-above/stats-below. The landscape route is inset so the full path stays inside the exported card.
- Native Maestro Apple Watch vitals flow passed on iOS 26.5 simulator, including the share-card editor, six stats, Landscape selection, all six stat labels, watermark and final screenshot at `test-results-native-ios/2026-09-18_115441/health-vitals-ios/takeScreenshot/workout-share-landscape.png`. Frontend TypeScript and `git diff --check` passed.
- IPA: `.release/2026-09-18T10-56-17-282Z-cdd0b6ed/tracking.so.ipa`. SHA-256: `db3aa0c9b0af628f923a78ced19ba2e72b74c4296418a07e6481954603a473c1`. Phone and embedded Watch companion are both build 111 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T10-56-17-282Z-cdd0b6ed-publish/distribution.json`. Links expire **September 25, 2026, 11:01:45 UTC**. Hosted verification returned HTTP 200 for light/dark installer pages, manifest and IPA, confirmed `itms-services:` links, no horizontal overflow, and matched the hosted IPA SHA-256 to the local artifact. The signed URL is intentionally not recorded here.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T10-56-17-282Z-cdd0b6ed/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T10-56-17-282Z-cdd0b6ed-publish/distribution.json
```

## Previous status — build 106, September 18, 2026

- **Local production build 106 is complete, verified and hosted**, version 1.0.0. It supersedes build 104 as the newest Safari-install artifact.
- The onboarding interview now uses DeepSeek V4.1 Flash for coach validation, keeps plan design separate from session generation, and presents compact goal guidance cards with debounced first-pass checks. Only hard requirements block continuation; useful context offers an explicit “Continue anyway” choice and no automatic button timers.
- The build includes the persistent Start over action beneath the create-plan controls and the save-error retry flow. The backend validator route is live in `local/tracking-so-backend:goal-guidance-jev-final-20260918`; its first-pass checks use Jev’s typed evaluator, while conversational coach feedback uses DeepSeek V4.1 Flash.
- IPA: `.release/2026-09-18T09-35-23-274Z-c4abac05/tracking.so.ipa`. SHA-256: `a9591d53dd7182a5203a430fc52938ae8c417176702e70b5078ca66b8d374303`. Phone and embedded Watch companion are both build 106 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T11-01-07-087Z-840e6deb/distribution.json`. Links expire **September 25, 2026, 11:01:14 UTC**. The publisher independently verified HTTP 200 for the installer, manifest and hosted IPA; the hosted IPA is 26,233,114 bytes and its SHA-256 matches the local artifact. The signed URL is intentionally not recorded here.
- TypeScript, backend interview tests (16), focused onboarding browser cases and strict local release/parity checks passed. The build was compiled locally with the existing production environment and signing credentials; no Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T09-35-23-274Z-c4abac05/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T11-01-07-087Z-840e6deb/distribution.json
```

## Previous status — build 104, September 18, 2026

- **Local production build 104 is complete, verified and hosted**, version 1.0.0. It supersedes build 101 as the newest Safari-install artifact.
- Workout elevation now uses a true vertical axis: the chart shows maximum, midpoint and minimum altitude labels in metres on the y-axis. The old distance tick labels and `Distance along route` caption were removed; the horizontal distance remains legible from the profile shape and route range summary.
- The share-card preview now scales the full canvas to the available phone width and sizes its viewport from the selected format, so portrait and landscape previews retain their intended aspect ratio instead of clipping inside a square-ish container. Landscape six-stat cards use a compact two-column grid; the exported PNG remains the full-size canvas with the faded `tracking.so` watermark.
- IPA: `.release/2026-09-18T112000-share-responsive/tracking.so.ipa`. SHA-256: `b879ae0abb2cb2b824445f31558ce4029063edb70eeb3128146e0049acf9a082`. Phone and embedded Watch companion are both build 104 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T09-27-35-802Z-348c628e/distribution.json`. Links expire **September 25, 2026, 09:27:43 UTC**. The publisher independently verified HTTP 200 for the light and dark installers, manifest and hosted IPA, `itms-services:` install schemes, no horizontal overflow, and a matching local/hosted SHA-256 for build 104. The signed URL is intentionally not recorded here.
- TypeScript and the focused workout-details/share-card Playwright E2E passed, including explicit viewport-fit assertions. Strict release codesign, iPhone/Watch provisioning CMS, matching phone/Watch bundle metadata and production bundle markers passed. The native iOS Maestro E2E remains blocked because CoreSimulatorService refuses connections on this Mac; no native simulator pass is claimed for this build.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/workout-vitals.spec.ts --reporter=line --trace=off
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T112000-share-responsive/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T09-27-35-802Z-348c628e/distribution.json
```

## Previous status — build 101, September 18, 2026

- **Local production build 101 is complete, verified and hosted**, version 1.0.0. It includes the onboarding save-error recovery fix: **Try again** resubmits the current clarification, and **Start over** is available as a quiet secondary action that creates a fresh clarification draft.
- The backend acceptance fix is live in production as `local/tracking-so-backend:interview-clarification-20260918` and healthy. The clarification facts remain separate from session generation; the legacy duration field is accepted only as a rollout-compatibility transport field and is stripped before the clarification facts reach the model.
- IPA: `.release/2026-09-18T08-46-46-594Z-3bc10ed5/tracking.so.ipa`. SHA-256: `8eebaed40cecc9703d50d0c70fc3aeb71f9a9c41d35dfc4d6a9bd79c67e94d3d`. Phone and embedded Watch companion are both build 101 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T08-51-44-446Z-d70130d9/distribution.json`. The link expires **September 25, 2026, 08:51:50 UTC**. The installer page, manifest and complete hosted IPA returned HTTP 200, and the hosted IPA SHA-256 matches the local artifact. The signed URL is intentionally not recorded here.
- Frontend and backend TypeScript passed; the focused onboarding Playwright tests passed, including the new Start over failure recovery case; the targeted interview backend suite passed (15 tests). Strict release signing, production environment and iPhone/Watch provisioning verification passed. The optional headless Chrome hosted-page check could not run because Chrome aborted on this Mac before loading; direct Safari installer assets were verified instead.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
python3 .release/check-parity-ipa.py .release/2026-09-18T08-46-46-594Z-3bc10ed5/tracking.so.ipa 101
AWS_PROFILE=default ./node_modules/.bin/tsx scripts/iphone/cli.ts publish .release/2026-09-18T08-46-46-594Z-3bc10ed5/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T08-51-44-446Z-d70130d9/distribution.json
```

## Previous status — build 99, September 18, 2026

- **Local production build 99 is complete, verified and hosted**, version 1.0.0. It supersedes build 97 as the newest Safari-install artifact.
- The running share-card export is now deliberately minimal in both portrait and landscape: the image contains only the route and selected workout stats. The previous `Running` / date / Apple Watch header is removed. A small, faded activity icon plus `tracking.so` watermark sits in the lower-right corner of the transparent canvas.
- The share-card editor still supports swipeable controls for route color, three or six stats, and portrait or landscape format. The landscape export places the map and stats side by side; the preview remains horizontally swipeable on a phone when the full canvas is wider than the sheet.
- IPA: `.release/2026-09-18T103000-share-watermark/tracking.so.ipa`. SHA-256: `f07040b9b58067f1e441b493b76b714f5397290880cfb4e73ef9aac03adc7825`. Phone and embedded Watch companion are both build 99 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T08-35-08-315Z-dc4a8ea1/distribution.json`. Links expire **September 25, 2026, 08:35:17 UTC**. The publisher independently verified HTTP 200 for the light and dark installers, manifest and hosted IPA, `itms-services:` install schemes, no horizontal overflow, and a matching local/hosted SHA-256 for build 99. The signed URL is intentionally not recorded here.
- TypeScript and the focused Playwright workout-details/share-card E2E passed. Strict release codesign, iPhone/Watch provisioning CMS, matching phone/Watch bundle metadata and production bundle markers passed. The native iOS Maestro E2E remains blocked because CoreSimulatorService refuses connections on this Mac; no native simulator pass is claimed for this build.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/workout-vitals.spec.ts --reporter=line
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T103000-share-watermark/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T08-35-08-315Z-dc4a8ea1/distribution.json
```

## Previous status — build 97, September 18, 2026

- **Local production build 97 is complete, verified and hosted**, version 1.0.0. It supersedes build 96 as the newest Safari-install artifact.
- Friends now sort by each person's non-deleted activity-entry count, including entries without a linked activity definition. The entry count is no longer displayed in the friends list, and the production backend is running the matching focused overlay `local/tracking-so-backend:friends-entry-count-20260918`.
- Workout details now label the elevation chart's x-axis with route-distance ticks (start, midpoint and finish) plus an explicit “Distance along route” caption, so the profile's rises and falls are easier to read.
- Running workout details now end with a **Create share card** action. The editor previews a transparent PNG route silhouette with start/finish markers and supports swipeable controls for route color (Sunset, Lime, Violet or Ice), three or six stats, and portrait or landscape format. Sharing uses the existing native `react-native-view-shot` + `expo-sharing` path; the captured canvas itself remains transparent.
- IPA: `.release/2026-09-18T08-10-18-989Z-664084d2/tracking.so.ipa`. SHA-256: `52dada2ce996261f37afee28ca1fae6c8e85703f260aeb8ae6635933d2cc7d17`. Phone and embedded Watch companion are both build 97 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T08-10-18-989Z-664084d2/distribution.json`. Links expire **September 25, 2026, 08:16:27 UTC**. The publisher independently verified HTTP 200 for the installer and manifest, a ranged hosted IPA download, and a matching local/hosted SHA-256 for build 97. The signed URL is intentionally not recorded here.
- Backend/frontend TypeScript, Vite lint, focused native profile tests (4/4), strict release codesign, iPhone/Watch provisioning CMS, matching phone/Watch bundle metadata and production IPA packaging passed. The existing Expo Doctor warnings remain non-blocking.
- The build was compiled locally with the existing production environment and signing credentials. No Expo cloud quota, OTA publication, paid subscription or App Store submission was used.

Exact release commands for this artifact:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
PATH=/private/tmp/tracking-pnpm-bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node --import tsx scripts/iphone/cli.ts release
node .release/verify-hosted.cjs .release/2026-09-18T08-10-18-989Z-664084d2/distribution.json
```

## Previous status — build 94, September 18, 2026

- **Local production build 94 is complete, verified and hosted**, version 1.0.0. It supersedes build 92 as the newest Safari-install artifact.
- This release contains the onboarding interview clarification change: weekly cadence is captured independently from session duration, and the clarification layer does not prescribe or generate sessions.
- IPA: `.release/2026-09-18T07-51-49-320Z-5a5580c1/tracking.so.ipa`. SHA-256: `fc0cbe3677cf11cfe7eca7815659293f960b0cdab02fc2d7d2990489b2272720`. Phone and embedded Watch companion are both build 94 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T07-58-52-776Z-c261c89d/distribution.json`. Links expire **September 25, 2026, 07:59:02 UTC**. The publisher verified HTTP 200 for the installer, manifest and complete hosted IPA; the hosted IPA is build 94 and its SHA-256 matches the local artifact. The signed URL is intentionally not recorded here.
- The full Playwright light/dark browser check could not run because headless Chrome aborted on this Mac; the publisher's direct hosted-resource checks passed. Physical installation still needs confirmation on the user's iPhone.
- The build was compiled locally with the existing production environment and signing credentials; no Expo cloud quota, OTA publication, paid subscription or App Store submission was used. The build workflow does not deploy the backend; the matching backend interview change remains in the working tree until separately released.

Exact release commands for this artifact:

```sh
python3 .release/check-parity-ipa.py .release/2026-09-18T07-51-49-320Z-5a5580c1/tracking.so.ipa 94
AWS_PROFILE=default ./node_modules/.bin/tsx scripts/iphone/cli.ts publish .release/2026-09-18T07-51-49-320Z-5a5580c1/tracking.so.ipa
node .release/verify-hosted.cjs .release/2026-09-18T07-58-52-776Z-c261c89d/distribution.json
```

## Previous status — build 92, September 18, 2026

- **Local production build 92 is complete, verified and hosted**, version 1.0.0. It supersedes build 91 as the newest Safari-install artifact.
- The Add-page **Log voice note** card and Home **Voice note waiting** card now use the same neutral card surface and border as the activity tiles. Only the larger standalone mic keeps a slight selected-theme tint (60% accent alpha); the card sits above the **Log Activity** header, with a little more horizontal breathing room and no filled mic badge.
- A native iOS 26.5 simulator capture passed in dark amber using the rebuilt current native bundle: `test-results-native-ios/2026-09-18_084800/voice-note-ios/takeScreenshot/native-dark-add-voice-note.png`. The capture confirms the app-native surface, neutral card treatment, card/header ordering and no filled mic badge; the existing PWA capture is not used as native evidence.
- The friends list now sorts by total logged activity count, uses circular profile avatars, and keeps the native profile navigation inside the persistent tab layout.
- IPA: `.release/2026-09-18T07-48-43-030Z-0f14c4a0/tracking.so.ipa`. SHA-256: `421cd077db29f6872daa1c03d6eaa20d3a9c122511f92d955aebdaf5c163a765`. Phone and embedded Watch companion are both build 92 (`so.tracking.app` and `so.tracking.app.watchkitapp`); both profiles expire September 10, 2027.
- Installer metadata: `.release/2026-09-18T07-53-28-796Z-53c4a11c/distribution.json`. Links expire **September 25, 2026, 07:53:38 UTC**. The publisher verified HTTP 200 for the installer, manifest and complete hosted IPA; the hosted IPA is build 92 and its SHA-256 matches the local artifact. The signed URL is intentionally not recorded here.
- The production backend overlay `local/tracking-so-backend:health-workout-graphs-20260918` is live and healthy, based on the active Garmin-backed image. It adds the Apple Health HR-series and route serializers while retaining elevation/zones. No database migration was required; rollback is preserved as `.env.before-health-workout-graphs-20260918` on the server.
- The build was compiled locally with the existing production environment and signing credentials; no Expo cloud quota, OTA publication, paid subscription or App Store submission was used. Expo Doctor still reports the pre-existing workspace-module gitignore warning and SDK patch-version drift; those did not prevent the signed archive. The same frontend source passed the DARK native iOS Maestro E2E in the preceding build, including the real MapKit route, elevation profile, HR chart, zones and colored icons; build 89 contains the same native markers.

Exact release commands from the repository root unless otherwise noted:

```sh
pnpm --filter frontend-expo exec tsc --noEmit
cd apps/frontend-expo
CI=1 node node_modules/@playwright/test/cli.js test e2e/voice-log.spec.ts --reporter=line
pnpm build:iphone:local
node --import tsx scripts/iphone/cli.ts package .release/2026-09-18T07-48-43-030Z-0f14c4a0/tracking.so.ipa
AWS_PROFILE=default pnpm build:iphone:publish .release/2026-09-18T07-48-43-030Z-0f14c4a0/tracking.so.ipa
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

## Workout PNG export regression checks

The share card lays out at the measured preview width without a transformed ancestor. Its route, stat cells and watermark share the same scale; landscape content stays centered inside the canvas. iOS exports the complete layer tree at native bounds using `useRenderInContext`. Keep `textShadowOffset` explicit: React Native's iOS text renderer ignores the shadow color/radius without an offset, making white text disappear when a transparent PNG is displayed on white.

From this frontend directory:

```sh
node node_modules/typescript/bin/tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/workout-vitals.spec.ts
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
E2E_IOS_DEVICE=1E390112-CE48-4DD6-B61B-431D00A8EA55 \
MAESTRO_BIN=/opt/homebrew/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-share-responsive-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=LIGHT node e2e/native/run.cjs --ios --workout-share
```

Repeat the native command with `E2E_THEME=DARK`. Use an available booted iOS 26.5 simulator and a simulator build containing the current native dependencies. The browser suite checks both edges of every stat, route endpoint and watermark against the canvas and preview, in both formats, with 3/6 stats, at 320/390px phone widths. Run browser and native fixture servers sequentially to avoid conflicting Metro environments.

The focused native flow opens all four formats and invokes the real iOS share sheet. The runner preserves the **actual shared temporary PNGs** before `releaseCapture` removes them, under `test-results-native-ios/workout-exports-THEME-TIMESTAMP/`. It checks native resolution, selected aspect ratio, transparent margins, route pixels, and OCR of every fixture statistic and the watermark on dark, plus pixel contrast in those text regions on white. These are fixture-only tests. Simulator Photos saving is not relied on as evidence; `1.png`–`4.png` are the actual export bytes, and `*.white.png` / `*.dark.png` are QA composites only.

Standalone verification of a captured export:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift -module-cache-path /private/tmp/tracking-share-swift-cache e2e/native/verify-workout-share.swift /absolute/path/to/4.png landscape 6
```

The native OCR check needs access to macOS Vision services. Run it with the same host permissions as native simulator tests. Read the latest Current status above before distributing; test outputs are not an IPA.

## Integrated workout graph fixture validation — September 23, 2026

This section records the independently completed **simulator and fixture** graph checks at integration commit `16593ac8` in the `tracking-feature-validation` worktree. The release status earlier in this file belongs to this worktree's older snapshot; the original `tracking-so` checkout now documents the unrelated verified build 152. These checks produced no IPA or install link. They do not verify a physical-device Apple/Garmin import or constitute a new production release.

The integration contains the app's **tracked** `modules/tracking-health/ios/` Swift sources and podspec. They must be present before prebuild; an Expo module directory containing only `package.json` cannot compile or ingest workout samples. The ignored `tracking-map/ios/` and `tracking-watch/ios/` sources were copied from the original checkout **only when absent**. Never overwrite tracked TrackingHealth sources. The validation worktree reused the original checkout's root `node_modules` through a **read-only** link and copied package-level `node_modules` trees with local `@tsw` workspace links redirected to this worktree. A fresh dependency install in this worktree is an alternative. Do not modify the original checkout's installed packages. From `apps/frontend-expo` in the integration worktree, reproduce the native source setup and fixture simulator binary with:

```sh
python3 - <<'PY'
from pathlib import Path
import shutil
source = Path('/Users/alramalho/workspace/tracking.so/tracking-so/apps/frontend-expo/modules')
for name in ('tracking-map', 'tracking-watch'):
    original = source / name / 'ios'
    target = Path('modules') / name / 'ios'
    if original.exists() and not target.exists():
        shutil.copytree(original, target)
PY
EXPO_NO_DOTENV=1 EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 node node_modules/expo/bin/cli prebuild --platform ios --no-install
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer pod install --project-directory=ios
EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -workspace ios/trackingso.xcworkspace -scheme trackingso -configuration Debug \
  -destination 'platform=iOS Simulator,id=1E390112-CE48-4DD6-B61B-431D00A8EA55' \
  -derivedDataPath /private/tmp/tracking-feature-validation-simulator \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=7P4CMS849D build
```

The fresh app is `/private/tmp/tracking-feature-validation-simulator/Build/Products/Debug-iphonesimulator/trackingso.app`. Pod installation completed with 131 pods in `/private/tmp/tracking-feature-validation-pods.log`; the Xcode build exited successfully with the app at that path (`/private/tmp/tracking-feature-validation-build.log`). The build includes the tracked TrackingHealth source and ExpoFileSystem 57.0.6. It is a fixture development client, never a production release.

Prebuild invoked the repository-local Expo CLI directly because this Mac's pnpm 11 launcher does not match the repository's pnpm 10 `packageManager` setting.

Run browser/model checks separately from native flows because the fixture servers use different ports:

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/kilometre-splits.test.ts tests/heart-rate-chart.test.ts
E2E_API_PORT=4321 E2E_WEB_PORT=8087 node node_modules/@playwright/test/cli.js test --config playwright.heart-rate-zones.config.ts
E2E_API_PORT=44317 E2E_WEB_PORT=48083 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/workout-vitals.spec.ts -g 'distance trace|linked workout privacy'
```

From `apps/backend-node`, the focused provider check was:

```sh
node node_modules/vitest/vitest.mjs run src/services/health/apple/schemas.test.ts src/services/health/apple/effort.test.ts src/services/health/garmin/normalization.test.ts
```

The independent checks passed 13 frontend graph model cases, 24 Apple/Garmin provider cases, 5 heart-rate browser cases and 4 workout-vitals browser cases. Browser logs are `/private/tmp/tracking-feature-validation-hr-browser.log` and `/private/tmp/tracking-feature-validation-splits-browser.log`; inspected split captures are in sibling `tracking-feature-validation-evidence/browser-splits/`. The model cases cover sparse traces, gaps, exact zone boundaries and post-pause heart-rate samples. These results use fixtures and do not prove that every historical provider record contains timed samples.

The native runner starts its own fixture API on 4319 and Metro on 8085, installs the **fresh app above**, and writes screenshots under `test-results-native-ios/`. Run one flow at a time on the iPhone 17 simulator (`1E390112-CE48-4DD6-B61B-431D00A8EA55`, iOS 26.5):

```sh
for flow in --splits --splits-missing --health-vitals; do
  for theme in DARK LIGHT; do
    JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
    MAESTRO_BIN=/opt/homebrew/bin/maestro \
    E2E_IOS_DEVICE=1E390112-CE48-4DD6-B61B-431D00A8EA55 \
    E2E_IOS_APP=/private/tmp/tracking-feature-validation-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
    E2E_THEME="$theme" node e2e/native/run.cjs --ios "$flow"
  done
done
```

The coordinating task ran all six combinations and inspected their screenshots. All passed:

| Flow | DARK log and captures | LIGHT log and captures |
| --- | --- | --- |
| Timed splits | `/private/tmp/tracking-feature-validation-native-splits-DARK.log`; `test-results-native-ios/2026-09-23_011417/` | `/private/tmp/tracking-feature-validation-native-splits-LIGHT.log`; `test-results-native-ios/2026-09-23_011438/` |
| Unavailable splits | `/private/tmp/tracking-feature-validation-native-splits-missing-DARK.log`; `test-results-native-ios/2026-09-23_011459/` | `/private/tmp/tracking-feature-validation-native-splits-missing-LIGHT.log`; `test-results-native-ios/2026-09-23_011519/` |
| Heart-rate vitals | `/private/tmp/tracking-feature-validation-native-health-vitals-DARK.log`; `test-results-native-ios/2026-09-23_011539/` | `/private/tmp/tracking-feature-validation-native-health-vitals-LIGHT.log`; `test-results-native-ios/2026-09-23_011703/` |

An earlier DARK attempt failed on an overly narrow Maestro text selector (`/private/tmp/tracking-feature-validation-native-hr-DARK.log`); the corrected combined-label matcher is in commit `42b0a462` and both final theme runs passed. These fixtures verify graph rendering, gaps and unavailable states; historical provider data may still lack timed samples.

## Offline activity logging validation — native checks completed

The native app persists the loaded timeline and activity picker per signed-in account. It stores each log and any selected photos locally before posting; the backend migration adds separate idempotency receipts for activity and photo requests. Deploy the migration before distributing a build with this queue. Clerk's experimental resource cache is enabled for native signed-in offline bootstrap. The fixture session does not prove a real Clerk session can cold start offline; verify that separately with a signed-in test account and the network disabled before app relaunch.

From the repository root, run the focused checks:

```sh
pnpm --filter @tsw/prisma db:generate
pnpm --filter frontend-expo typecheck
pnpm --filter backend-node exec tsc --noEmit
cd apps/frontend-expo
node --import tsx --test tests/offline-queue.test.ts
```

The route concurrency test requires a disposable PostgreSQL cluster. Its script refuses any database other than `tracking_offline_test` on the exact Unix socket below. S3 is mocked in process; it sends no production media or notifications. From the repository root:

```sh
mkdir -p /private/tmp/tracking-offline-pg-sock
initdb -D /private/tmp/tracking-offline-pg-data --no-instructions --auth=trust
pg_ctl -D /private/tmp/tracking-offline-pg-data -o "-c listen_addresses= -c unix_socket_directories=/private/tmp/tracking-offline-pg-sock -p 55432" -l /private/tmp/tracking-offline-pg.log start
createdb -h /private/tmp/tracking-offline-pg-sock -p 55432 tracking_offline_test
DATABASE_URL='postgresql://alramalho@localhost:55432/tracking_offline_test?host=/private/tmp/tracking-offline-pg-sock' DIRECT_URL='postgresql://alramalho@localhost:55432/tracking_offline_test?host=/private/tmp/tracking-offline-pg-sock' pnpm --filter @tsw/prisma exec prisma db push --schema schema.prisma --accept-data-loss
psql -h /private/tmp/tracking-offline-pg-sock -p 55432 -d tracking_offline_test -v ON_ERROR_STOP=1 -c 'DROP TABLE public.activity_photo_requests, public.activity_log_requests'
psql -h /private/tmp/tracking-offline-pg-sock -p 55432 -d tracking_offline_test -v ON_ERROR_STOP=1 -f packages/prisma/migrations/20260923090000_activity_log_requests/migration.sql
cd apps/backend-node
DATABASE_URL='postgresql://alramalho@localhost:55432/tracking_offline_test?host=/private/tmp/tracking-offline-pg-sock' DIRECT_URL='postgresql://alramalho@localhost:55432/tracking_offline_test?host=/private/tmp/tracking-offline-pg-sock' NODE_ENV=test AI_GATEWAY_API_KEY=local-fixture-only node --import tsx --test scripts/offline-idempotency.test.ts
pg_ctl -D /private/tmp/tracking-offline-pg-data stop -m immediate
```

Replace `alramalho` in the disposable database URLs with the current macOS username on another Mac. Reinitialize or remove the temporary data directory before repeating the setup. The test checks concurrent duplicate log requests, the same request ID under two accounts, concurrent distinct photo uploads, and photo replay without another S3 write.

Because offline photo staging adds `expo-file-system`, make a fresh fixture simulator app before the native flow. From `apps/frontend-expo`, with a booted iOS simulator and Xcode 26.4 or later:

```sh
EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 pnpm exec expo prebuild --platform ios --no-install
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer pod install --project-directory=ios
EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4319 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -workspace ios/trackingso.xcworkspace -scheme trackingso -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/tracking-offline-simulator CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=7P4CMS849D build
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 E2E_IOS_APP=/private/tmp/tracking-offline-simulator/Build/Products/Debug-iphonesimulator/trackingso.app MAESTRO_BIN=/opt/homebrew/bin/maestro E2E_THEME=DARK node e2e/native/run.cjs --ios --offline
```

Repeat the last command in `LIGHT`. The fixture runner alone owns ports 4319/8085 and its simulator. It caches Home and Add online, disconnects the fixture API, logs and restarts offline, then restores the API while losing the first successful response. It requires one final server entry and the same request ID on replay. This simulator bundle is fixture-only. The completed DARK/LIGHT offline flows and DARK native photo staging/restart/replay flow are recorded in the current release section. Actual Clerk offline cold-start remains a physical-device confirmation; the user requested delivery without expanding validation further.
