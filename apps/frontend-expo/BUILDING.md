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

## Safari-install build 188 — circle encouragement, September 30, 2026

- Local production release from `9cce3691`, preserving current main `eda9fab9` and adding encouragement `0022291e`. Tapping the circle hand opens “Motivate Alex” with their avatar and a blank personal message; opening/dismissing sends nothing. Only Send delivers a private message through the ordinary chat notification path. Both circle board and plan entry points use this flow, on Expo and Vite.
- Verified IPA: `/Users/alramalho/workspace/tracking.so/tracking-circles/apps/frontend-expo/.release/circle-encouragement-b188/tracking.so.ipa`. SHA-256 `199142f74141b5719076ec80762d6b6661622450f00d547429446c11748301c7`; version 1.0.0, iPhone and Watch build 188. Strict release signatures, registered phone/Watch provisioning, production API/live Clerk, fixture exclusion and bundled JavaScript passed. TrackingWatch, TrackingHealth and TrackingMap were installed and compiled; the encouragement copy was checked in the exact Hermes bundle.
- Hosted installer record: `.release/2026-09-30T21-43-57-519Z-11c2bded/distribution.json` in the same worktree. Installer, manifest identity and all 28,135,732 hosted IPA bytes passed SHA-256 verification. The seven-day link expires October 7, 2026; the precise expiry and private signed URL remain in the ignored record. Installation on a physical device has not been observed.
- Expo typecheck, Vite production build/typecheck, 17 backend circle integration cases, 3 circle model cases and 2 light/dark phone browser cases passed. The browser suite verifies no request on opening/dismissing, no legacy nudge, retained draft/retry after failure and explicit Send. [Walkthrough and actual app captures](../../docs/reviews/circle-encouragement/index.html) use illustrative members.
- Web deployment `dpl_Dn8gZhBeDshotj5QcgKKYpkP8FsV` is active at `https://app.tracking.so`; complete HTML, JS/CSS and lazy-loaded drawer/circle assets match the local production output. Previous deployment `dpl_9ZsEHWa7DiZ8ZiajUGTaHqkZrYNg` remains the rollback target. The backend is `circle-encouragement-20260930`; see [deployment and rollback](../../hetzner/MIGRATION.md#circle-encouragement--active-since-september-30-2026). No schema migration.
- Build 187 was interrupted before export to rebuild with the newer main commits; it produced no IPA and was never published. Build 188 used the app’s existing matched iPhone/Watch ad hoc credentials downloaded locally, without creating a certificate/profile. No cloud build, OTA or TestFlight publication occurred; build 177 remains the recorded TestFlight release.

The build used a clean integration clone at `/private/tmp/tracking-encouragement-integrated`, with the existing workspace dependencies and production environment copied into ignored paths. Preserve the root `.easignore`. For a local matched-credentials build, run EAS credentials in this app directory, select `device-production` → `credentials.json` → Download → Ad hoc, and use the downloaded `credentials.json`/`credentials/ios` only in the local build source (never track them). Set `build.device-production.credentialsSource` to `local` in that build copy’s `eas.json`; keep the tracked default intact. On this Mac:

```sh
cd /private/tmp/tracking-encouragement-integrated/apps/frontend-expo
PNPM_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm dlx eas-cli@24.0.0 credentials --platform ios
EAS_PROJECT_ROOT=/private/tmp/tracking-encouragement-integrated \
PNPM_MANAGE_PACKAGE_MANAGER_VERSIONS=false AWS_PROFILE=default \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' \
node --import tsx scripts/iphone/cli.ts build
```

Build 188’s source archive, local build profile, build log and `verified.json` are beside the preserved IPA. Publish that exact IPA and check the exact hosted bytes from the original worktree:

```sh
cd /Users/alramalho/workspace/tracking.so/tracking-circles/apps/frontend-expo
AWS_PROFILE=default DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
NODE_OPTIONS='--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000' \
node --import tsx scripts/iphone/cli.ts publish .release/circle-encouragement-b188/tracking.so.ipa
node scripts/iphone/verify-hosted.cjs .release/2026-09-30T21-43-57-519Z-11c2bded/distribution.json
```

The hosted-byte checker GETs the exact installer, follows its manifest, checks build/bundle metadata and hashes the full IPA against the local verification record. Open the returned HTTPS page in Safari and tap **Install on iPhone**. Signed links stay out of tracked docs.

