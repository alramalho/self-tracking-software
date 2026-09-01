# iOS + Apple Watch release status

Last audited: 2026-09-01

## Current state

The repository contains a Capacitor iOS app and a native watchOS companion. The production API at `https://api.tracking.so` exposes the activity, watch-token refresh, and Apple Sign-In routes used by the Watch app.

No current signed archive (`.xcarchive`), uploaded build, or TestFlight build was found. The existing local simulator output predates the latest Watch and Apple Health changes and is not release evidence.

## Targets and release configuration

- Workspace: `apps/frontend-vite/ios/App/App.xcworkspace`
- iOS app: `so.tracking.app`, iOS 15.0+
- Watch app: `so.tracking.app.watchkitapp`, watchOS 10.0+
- Apple team: `7P4CMS849D`
- Marketing version: `1.0`
- Build number: `20260901`
- Shared archive scheme: `App` (builds the Watch target before the iOS app)

## Implemented integration

### iPhone app

- Activates `WatchConnectivity` and sends VPS-issued access and refresh tokens after login.
- Keeps the latest authentication payload and retries it after session activation or Watch state changes.
- Uses application context for latest-state delivery, user-info transfer for queued delivery, and an immediate message when the Watch is reachable.
- Responds when the Watch explicitly requests the latest credentials.
- Includes Sign in with Apple, App Groups, HealthKit, and the privacy manifest.
- Hides Stripe purchase and subscription-management links in the native iOS shell. The first release is therefore an existing-subscriber companion rather than an in-app digital purchase flow.

### Watch app

- Receives authentication through all supported `WatchConnectivity` delivery paths and requests credentials on activation/reachability.
- Can fall back to direct Sign in with Apple.
- Refreshes the dedicated watch token through `/auth/watch-refresh`.
- Fetches activities and logs activity entries against the production API.
- Handles nullable activity colors and unauthorized responses without depending on localized error strings.
- Has a referenced, fully opaque 1024×1024 App Store icon.

### Backend

- `/auth/ios-apple-signin` accepts Apple identity tokens issued to either the iOS app bundle or the Watch app bundle.
- `/auth/watch-refresh` exchanges the Watch refresh token for a new access token.
- The production service has the Watch auth configuration and routes, but the broadened Watch Apple-token audience change in this branch still needs the normal production deployment.

## Validation completed

- Frontend production build and TypeScript project build.
- Backend TypeScript build.
- Apple Health backend tests: 11 passing.
- Swift parser validation for the Watch sources and iPhone Watch bridge.
- Property-list, entitlements, asset catalog, and shared-scheme XML validation.
- App icon dimensions and alpha-channel checks.

A signed compile/archive cannot run on the current machine yet because only Apple Command Line Tools are installed. CocoaPods is also unavailable. `cap sync ios` copied the current production web bundle and updated Capacitor plugins, then stopped at the native dependency step for those reasons.

## Remaining release blockers

1. Install Xcode 26.3 and select it:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

2. Install CocoaPods and refresh native dependencies:

   ```bash
   cd apps/frontend-vite/ios/App
   pod install
   ```

3. Sign into Xcode and App Store Connect with the team account, then confirm:

   - Automatic signing succeeds for both bundle IDs.
   - `so.tracking.app.watchkitapp` exists and has Sign in with Apple and App Groups enabled.
   - App Group `group.so.tracking.app` is attached to both targets.
   - The App Store Connect app record, agreements, tax, and banking state are ready.

4. Deploy the backend Apple audience change through the normal production deployment.

5. Run the paired-device acceptance test:

   - Install the App scheme on a paired iPhone and Apple Watch.
   - Sign in on iPhone and confirm activities appear on Watch without Watch-side login.
   - Log an activity from Watch and verify it in the iOS/web app.
   - Sign out and test direct Watch Sign in with Apple.
   - Verify Apple Health permission, import, and duplicate handling on a physical iPhone.

6. Archive the shared `App` scheme with the generic iOS device destination, validate, and upload to App Store Connect.

7. Complete App Store metadata: privacy answers, age rating, support/privacy URLs, iPhone screenshots, Watch screenshots, review notes, and export-compliance answers. Release through TestFlight first, then submit the same validated build for review.

## Product decision after the first release

The native app currently avoids external purchase calls to action so it can operate as a free companion for existing subscribers. If Plus must be purchasable inside the iOS app, implement StoreKit/In-App Purchase and App Store receipt-to-entitlement synchronization before exposing an upgrade button in the native shell.
