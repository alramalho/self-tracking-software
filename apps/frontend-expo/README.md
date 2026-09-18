# tracking.so — Expo frontend

Parallel React Native frontend for the existing tracking.so backend. `frontend-vite` and its Capacitor app remain in place during migration. The Expo application does not embed the Vite UI in DOM views or a WebView.

## Development

From the repository root:

```sh
pnpm install
pnpm --filter frontend-expo start
pnpm --filter frontend-expo ios
pnpm --filter frontend-expo android
pnpm --filter frontend-expo web
```

Use a development build, not Expo Go: Clerk's native authentication view and other native dependencies require it. Expo generates the ignored `ios/` and `android/` directories through prebuild; native configuration belongs in `app.config.ts`.

This app uses Expo SDK 57 / React Native 0.86. iOS targets 17.0 or later. SDK 57 requires Xcode 26.4 or later. The checked EAS `sdk-57` image supplies a supported toolchain. Select Xcode through `DEVELOPER_DIR` if the machine's default developer directory points to Command Line Tools.

### Environment

The app reads these public values, in order: `EXPO_PUBLIC_*` environment variables, `VITE_*` environment variables, then the sibling `frontend-vite/.env` file:

- `BACKEND_URL`
- `CLERK_PUBLISHABLE_KEY`

Only those two whitelisted values are copied from Vite. Backend credentials and Clerk secret keys never belong in an Expo app. See `.env.example` for standalone configuration. Use the computer's LAN address for a physical phone; its `localhost` refers to the phone. Start the existing backend separately.

## Native behavior

- Inter is bundled locally in the original regular, medium, semibold and bold weights. Screen text and inputs retain the existing typography without downloading fonts at runtime.
- Expo Router native tabs provide the system Liquid Glass floating tab bar on iOS 26, minimize while scrolling, and use native Material tabs on Android.
- Pull-to-refresh uses `RefreshControl`; timeline and profile history use virtualized lists. Heatmaps virtualize horizontal weeks while preserving the existing cell colors, segmented days, pause markers, selection and completion indicators.
- Plan tiles reorder after a deliberate long press, with movement animated on the UI thread and order saved through the existing bulk-update endpoint.
- Native date pickers, camera/library selection, location permission, share sheets and page-sheet modals replace browser/Capacitor bridges.
- Sign-in uses the existing “t” app icon, a centered native form, and light/dark Clerk styling from `src/auth/native-theme.json` via the Clerk config plugin. Signed-out screens follow the device appearance; signed-in screens use the saved theme. Native theme changes require a new build.
- Timeline cards preserve Vite's 16-point corners and activity/participant hierarchy. General cards and Add tiles use 20-point corners; controls use 16-point corners. The photo viewer is a native full-screen route with a safe-area close button, outside-image dismissal, and iOS pinch zoom.
- Clerk's native `AuthView` handles sign-in/up and configured account tasks. Web uses Clerk's web `SignIn` component. Configure the Clerk native application and providers for the bundle ID before device authentication testing.
- Clerk's iOS OAuth callback is `so.tracking.app://callback`, using the bundle identifier rather than the app's `trackingso` deep-link scheme. Allow this exact URL in the production Clerk instance's mobile SSO redirect settings. It was registered on September 12, 2026 after the first phone test exposed the missing allowlist entry; the existing build already registers the `so.tracking.app` scheme, so this server configuration fix requires no rebuild.
- Queries persist by signed-in user; sign-out clears that user's cached data. Mutations remain explicit network operations.
- iOS notification registration sends the **APNs device token** expected by the unchanged backend, not an Expo push token. Physical-device delivery still requires verification with the existing APNs credentials.

## Build and publishing

**Read [BUILDING.md](BUILDING.md) first.** The default `build:iphone` command now compiles on the Mac, verifies the IPA and publishes an expiring Safari installation link. It never falls back to Expo cloud builds. The guide records the successful build 11 workflow, toolchain setup and link renewal instructions. Cloud builds are available explicitly as `build:iphone:cloud`.

EAS project: `@alramalho/tracking-so` (`45c5e480-d33f-4c91-b692-520122979596`). Both native production identifiers remain `so.tracking.app` for continuity with the existing store application. Installing on a device with that identifier replaces that device's existing app; the source frontends remain parallel.

```sh
pnpm --filter frontend-expo build:simulator
pnpm --filter frontend-expo build:iphone
pnpm --filter frontend-expo build:preview
pnpm --filter frontend-expo build:production
pnpm --filter frontend-expo submit:ios
pnpm --filter frontend-expo submit:android
```

The build commands pin EAS CLI 24.0.0 via `pnpm dlx`. The iPhone wrapper uses `--local`; the other EAS build scripts listed above use cloud infrastructure. Profiles cover a simulator development client, internal previews (APK on Android), and store builds with remote build-number management. Configure the public backend URL and Clerk publishable key in the corresponding EAS environment; local production public configuration lives in ignored `.release/production.env.json` as described in BUILDING.md. Signing credentials and store-account selection remain EAS-managed setup steps. TestFlight build, Apple validation and direct upload commands are documented in BUILDING.md; no OTA publication has been performed.

The current TestFlight distribution is build 78, uploaded, processed, attached to the external `Friends & Family` group and submitted for Apple’s external beta review (`WAITING_FOR_REVIEW`). The group’s public link is enabled with a 100-tester limit, and the approved beta-review metadata plus dedicated Clerk demo account are configured. The ignored App Store Connect API key used by the repeatable local workflow lives at `.release/appstore-connect/AuthKey_RRBPAL9WF4.p8`; never commit that file or its contents.

`build:iphone` uses the `device-production` profile: an internal release build with bundled JavaScript, the production API at `https://api.tracking.so`, and the live Clerk publishable key from the deployed frontend. It uses EAS's production environment and does not require Metro. Only devices included in its ad hoc provisioning profile can install it. This is a testing build; migration parity remains in progress.

The repository-root `.easignore` permits only Expo application code, workspace configuration and the small shared frontend utilities that it imports. It excludes the backend, Vite, Capacitor/native generated directories, local environment files and secret material. Inspect the archive before uploading when changing workspace dependencies:

```sh
cd apps/frontend-expo
pnpm dlx eas-cli@24.0.0 build:inspect --platform ios --profile simulator --stage archive --output /tmp/tracking-expo-archive
```

## Validation

```sh
pnpm --filter frontend-expo typecheck
pnpm --filter frontend-expo test
pnpm --filter frontend-expo test:e2e
pnpm --filter frontend-expo build
```

Playwright starts Metro and a stateful **local fixture API** on ports 8083 and 4317. It covers activity logging/editing/deletion and retry, timeline reactions/comments, plans/profile heatmaps, metric check-ins, plan creation/editing/dates/visibility, milestone progress, profile ownership, drag ordering, and light/dark screenshots. This validates React Native Web screen behavior and API request shapes; it is not a substitute for a live-backend or native-device run.

Fixture authentication is enabled only in development with `EXPO_PUBLIC_E2E=true` and a loopback API. Configuration rejects it in EAS and production; runtime authentication also checks `__DEV__`.

### Real-backend browser validation

The separate live suite signs in with the existing Clerk E2E account and verifies writes with Prisma. It runs the unchanged backend with scheduled jobs disabled and uses an isolated local database. It does not use the fixture authentication token. Passwords and session tokens are excluded from Playwright traces.

Prerequisites: PostgreSQL 18 with pgvector, a local database named `tracking_expo_e2e` on `127.0.0.1:55432`, and Redis on `127.0.0.1:56379`. Apply `packages/prisma/schema.prisma` to that database with `prisma db push`. The seeder is restricted to this exact local database and replaces only its Expo test users. It reads the existing backend/Vite environment files and the repository's E2E account settings; `APP_TEST_USER_EMAIL` and `APP_TEST_USER_PASSWORD` override those settings.

```sh
pnpm --filter frontend-expo test:e2e:live
```

Playwright starts the local API on 4318 and Expo on 8084 if necessary. Run fixture and live suites sequentially: both rebuild the app with different public configuration. Neither suite proves native device behavior. The live suite covers Clerk password sign-in, activity creation/editing, timeline, plan day details, profile history, metrics and persistence after reload.

### Android emulator validation

Install Android SDK API 36, build tools 36.0.0, NDK 27.1.12297006, JDK 17 and [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli). Local validation uses Maestro 2.9.0; 2.10.0 intermittently lost its driver connection on this emulator. Start an ARM64 emulator on Apple Silicon. Build the development client with `pnpm --filter frontend-expo android`, then stop its Metro server before running:

```sh
pnpm --filter frontend-expo test:e2e:android
```

The runner installs the development APK on an emulator, clears only its tracking.so app data, starts an isolated fixture API on 4319 and Metro on 8085, and forwards those ports with ADB. Maestro covers logging, timeline expansion, plans/profile grids, metric check-ins, refresh and light/dark screenshots, followed by API persistence assertions. Results and local server logs go into ignored `test-results-native/`. Set `ANDROID_HOME`, `JAVA_HOME`, `MAESTRO_BIN`, `E2E_ANDROID_DEVICE` or `E2E_ANDROID_APK` when their defaults do not match your machine. This flow uses fixture authentication and does not prove native Clerk sign-in or production services. Run it sequentially with the browser suites and production export.

### iOS simulator validation

Boot an iOS simulator and download/extract the simulator development build from EAS. With Maestro and JDK 17 installed, run:

```sh
E2E_IOS_APP=/absolute/path/to/tracking.so.app pnpm --filter frontend-expo test:e2e:ios
```

The runner installs the supplied app on the booted simulator, starts the local fixture API and Metro, and runs the iOS parity flow. Set `E2E_IOS_DEVICE` to select a booted simulator and `MAESTRO_BIN`/`JAVA_HOME` as necessary. Output goes to ignored `test-results-native-ios/`. Run sequentially with other E2E suites. This verifies fixture behavior, not production authentication.

## Migration status

Migration is in progress. See `MIGRATION.md` for the remaining parity and release checks. Do not remove Vite/Capacitor or treat browser fixture coverage as native release approval.

To exercise joint timeline photos and repeated dismissal on iOS, run the same native runner with `--ios --timeline-design`. It seeds only the isolated fixture API, checks both participants and three photos, and tests the close control and outside-image dismissal in dark/light mode.

Use `node e2e/native/run.cjs --ios --reactions` with the same simulator environment to check the floating reaction island in dark/light mode, outside dismissal, and add/remove persistence. The trigger must be centered before tapping because the translucent native tab bar can visually expose a control underneath it.


Native coach messaging regression: `node e2e/native/run.cjs --ios --messages` with the same simulator environment as the other iOS flows. Browser contracts: `pnpm exec playwright test e2e/messages.spec.ts e2e/reactions.spec.ts`. These use the isolated loopback fixture API; release builds retain production authentication and the production backend.
