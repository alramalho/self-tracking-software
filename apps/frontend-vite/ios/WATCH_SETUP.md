# iOS Capacitor app + Apple Watch companion — setup status

## Goal

Ship the tracking.so iOS app via Capacitor (reusing the existing web FE) **with a companion Apple Watch app** that can:

1. List the user's activities (pulled from the existing backend at `https://api.tracking.so`).
2. Log an activity entry from the watch.
3. Inherit the iPhone's Supabase auth session via `WatchConnectivity`, with Sign-in-with-Apple fallback directly on the watch.

---

## Report — what's in place

### iPhone (Capacitor) app
- Capacitor project at `apps/frontend-vite/ios/App/App.xcworkspace`.
- App target bundle ID: `so.tracking.app`, team `7P4CMS849D`, iOS 14.0 deployment.
- Entitlements: Sign in with Apple, App Group `group.so.tracking.app`, APNs env=development.
- New Swift bridge files registered in the **App** target:
  - `App/WatchSessionManager.swift` — activates `WCSession`, `transferUserInfo({access_token, refresh_token})`.
  - `App/WatchAuthPlugin.swift` — Capacitor plugin `WatchAuth.sendTokens()` calling the session manager.
- Frontend bridge wired in `src/contexts/auth/provider.tsx` — calls `WatchAuth.sendTokens()` after login/auth state change.
- Backend endpoint `/auth/ios-apple-signin` (apps/backend-node/src/routes/auth.ts:106) verifies Apple `identityToken` and returns a Supabase verification URL.

### Apple Watch app
- `TrackingWatch` watchOS 10.0 target, bundle `so.tracking.app.watchkitapp`, team `7P4CMS849D`.
- Entitlements: Sign in with Apple, App Group `group.so.tracking.app`.
- Source files registered in target:
  - `TrackingWatchApp.swift` — root scene, routes to `ActivityListView` or `LoginView`.
  - `AuthManager.swift` — tokens in Keychain; JWT expiry check; refresh via Supabase; Apple-Sign-In → `/auth/ios-apple-signin` → Supabase magiclink verify.
  - `ConnectivityService.swift` — receives tokens from the iPhone via `WCSession`.
  - `LoginView.swift` — `SignInWithAppleButton` fallback for watch-only login.
  - `ActivityListView.swift` — list + sign-out button.
  - `LogActivityView.swift` — quantity picker + log button, haptic feedback.
  - `APIService.swift` — `GET /activities/` and `POST /activities/log-activity` (multipart) against `https://api.tracking.so`.
  - `Models.swift` — `Activity`, `ActivityEntry`, token/Apple-signin DTOs.
- `Assets.xcassets` (AccentColor + empty AppIcon set) registered as target resource.
- `Info.plist` has `WKApplication=true`.

### Project wiring
- **Embed Watch Content** copy-files phase on the App target (destination `$(CONTENTS_FOLDER_PATH)/Watch`, references `TrackingWatch.app`). No explicit target dependency — Xcode handles multi-platform SDK resolution implicitly; a direct dependency breaks CLI builds because it propagates the iOS SDK to the watch target.
- Idempotent Ruby setup script at `ios/App/setup_watch_target.rb` (uses `xcodeproj` gem 1.27.0). Re-run if the project needs re-provisioning.
- Backup of the pre-change `project.pbxproj` at `ios/App/project.pbxproj.backup`.

### Verification done
- `xcodebuild -list` → both schemes present (`App`, `TrackingWatch`).
- `xcodebuild -target TrackingWatch -sdk watchsimulator … build` → **BUILD SUCCEEDED**.
- `xcodebuild -target TrackingWatch -showBuildSettings` → `SDKROOT=watchos`, `PRODUCT_BUNDLE_IDENTIFIER=so.tracking.app.watchkitapp`, `WATCHOS_DEPLOYMENT_TARGET=10.0`, `CODE_SIGN_ENTITLEMENTS=TrackingWatch/TrackingWatch.entitlements`.
- `npx cap sync ios` — copied `dist/` → `ios/App/App/public/`, registered plugins, updated Podfile with missing `CapacitorGeolocation` pod.

### Bug fixes while reading the watch code
- `Models.swift:9` — `colorHex` made optional (DB field is nullable; was crashing decode).
- `APIService.swift:66` — send `quantity` as `String(Int(quantity.rounded()))`; backend does `parseInt` and would silently truncate decimal strings.

---

## Missing TODOs

### Blocking the first test run
- [ ] **Re-point `xcode-select` at Xcode and install pods** (CLT-only shell right now):
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  cd apps/frontend-vite/ios/App && pod install
  ```
- [ ] **Pick env mode** (prod vs LAN) and rebuild the Vite bundle:
  - Prod end-to-end (recommended first): set `VITE_BACKEND_URL=https://api.tracking.so`, Supabase URL/anon key to prod values from `.env.proddb`, then `pnpm build && npx cap sync ios`. Matches what the Watch Swift code hardcodes.
  - LAN dev: requires editing `TrackingWatch/APIService.swift:5` and `TrackingWatch/AuthManager.swift:13-14` to LAN URLs **and** setting up an HTTPS tunnel (ngrok/Cloudflare) because Apple Sign-In requires HTTPS.
- [ ] **Signing & capabilities on the Watch target** (Xcode → TrackingWatch → Signing & Capabilities):
  - Team = `7P4CMS849D`, automatic signing.
  - Re-add capabilities so provisioning profile picks them up: Sign in with Apple, App Groups (`group.so.tracking.app`).
- [ ] **Apple Developer portal** — confirm the `so.tracking.app.watchkitapp` App ID exists with Sign-In-with-Apple enabled and is grouped under the primary `so.tracking.app` App ID. Xcode normally creates this automatically; only intervene if it errors.

### Testing
- [ ] Build App scheme on a paired iPhone+Watch destination (device or simulator pair).
- [ ] Log in on iPhone, confirm watch auto-receives tokens and shows `ActivityListView`.
- [ ] Tap activity → adjust quantity → Log → confirm entry in web app.
- [ ] Sign out on watch → confirm `LoginView` shows → test watch-only Apple Sign-In path.

### Known quirks / nice-to-haves
- [ ] `WCSession.transferUserInfo` is queued, not instant. If token delivery is flaky, consider adding `updateApplicationContext` as a faster sibling path, or a manual "send tokens" button in iPhone settings.
- [ ] Watch `AppIcon.appiconset` has no images yet (`Contents.json` only). Needed before App Store submission.
- [ ] Hardcoded Supabase URL + anon key in `TrackingWatch/AuthManager.swift` — acceptable for anon key (public), but consider moving to a build-time xcconfig for clarity.
- [ ] Watch APNs not wired. When/if we want push to the watch, use the APNs key at `apple-stuff/AuthKey_MG38JC6M33.p8` (Key ID `MG38JC6M33`) and register remote notifications on the watch side.
- [ ] `quantity Int` mismatch: backend stores Int, watch UI supports 0.5 increments for hour/km/mile measures but we round to Int on send. Either drop the 0.5 step on watch UI, or change the DB column to Float (out of scope).

### Rollback
If the Xcode project ever gets into a bad state from the setup script:
```bash
cp apps/frontend-vite/ios/App/project.pbxproj.backup \
   apps/frontend-vite/ios/App/App.xcodeproj/project.pbxproj
```
Then re-run `ruby apps/frontend-vite/ios/App/setup_watch_target.rb` — it's idempotent.
