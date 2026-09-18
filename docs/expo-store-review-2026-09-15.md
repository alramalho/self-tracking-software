# Expo migration and App Store review — September 15, 2026

## Scope and conclusion

Reviewed the working source, the actual locally built production-connected IPA **1.0.0 (23)**, and current Apple documentation. This is a readiness review, not an App Store submission or a claim of physical-device validation. App Store Connect metadata, review credentials, distribution territories and commercial agreements were not inspected. Existing uncommitted changes were retained.

**Build 23 is missing the Apple Watch companion. The iPhone app also has unresolved App Store review risks.** **The companion has now been restored in locally compiled build 26.** Independent inspection of its actual IPA passed: embedded watchOS app, matching phone/Watch versions and build numbers, icon resources, release signatures, registered Watch provisioning and production configuration. Evidence is `apps/frontend-expo/.release/2026-09-15T13-30-14-866Z-4cbe83cf/watch-audit.json`. Physical installation and paired-device login synchronization remain for the user to confirm. Installation status and exact commands are in `apps/frontend-expo/BUILDING.md`. The App Store findings below remain open.

## Watch finding in build 23 — resolved in build 26

The ZIP has no `Payload/*.app/Watch/*.app`. Expo's original config had no Watch target/plugin; its authentication provider only used Clerk. Capacitor still has the full Swift companion and phone bridge under `apps/frontend-vite/ios/App/`, including the call from `src/contexts/auth/provider.tsx` to `/auth/watch-tokens`.

The existing companion is marked independent. It has its own Apple sign-in, Keychain credentials, token refresh and production API activity list/logging. An already-installed copy could therefore continue working independently, but that was not tested on the user's Watch. Build 23 cannot install it or send it updated login/logout state. Saved refresh tokens have a rolling 30-day lifetime; offline/expired credentials and signing configuration affect continued use.

Restoration requires the native target, embedding/signing, and the phone bridge—not just copying Swift files. The clean Expo build must regenerate the target. [Apple watchOS project guidance](https://developer.apple.com/documentation/technotes/tn3157-updating-your-watchos-project-for-swiftui-and-widgetkit), [Expo extension signing metadata](https://docs.expo.dev/build-reference/app-extensions/).

## Findings to resolve before App Store submission

### 1. Coaching purchase flow needs a storefront strategy — high priority

`apps/frontend-expo/src/features/onboarding/Onboarding.tsx:710` opens the backend offer URL in a browser. `apps/backend-node/src/services/follow-through/onboarding/billing.ts` returns a Stripe payment link for recurring coaching. Settings also opens Stripe billing. There is no StoreKit purchase/restore implementation or storefront branching in these paths.

For digital coaching, implement Apple purchases and entitlement synchronization where required, or deliberately adopt an eligible storefront-specific external-purchase arrangement. A universal Stripe link is not a safe worldwide submission strategy. US storefront external-link treatment differs; do not describe Stripe as prohibited everywhere. [Guidelines 3.1.1–3.1.3](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase).

### 2. Social-content safety controls are missing — high priority

Expo exposes direct messages, comments, photos and discoverable circles. Its source has no report-content/report-user or block-user controls. The circle API supports create/join/share/remove-own-content/leave, but has no moderation/report route. A `BLOCKED` enum value in Prisma is not an implemented user control; metric feedback is unrelated.

Implement content reporting, user blocking enforced by the backend, filtering, a moderation response process and reachable support. [Guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content).

### 3. Privacy access and AI-sharing permission are incomplete — high priority

Expo's settings, onboarding and chat source have no privacy/terms links or explicit permission step explaining external AI sharing. The coach agent uses the AI SDK gateway with user context and tools reading activity and metric history. Opting into reminders or selecting coaching does not itself explain the external data recipients.

Add accessible policy links and explicit permission before personal data reaches third-party AI, with enforcement in all relevant backend paths. [Guidelines 5.1.1(i), 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#privacy).

The live [privacy policy](https://tracking.so/privacy) and [terms](https://tracking.so/terms) load. The policy covers Apple Health imports and says imported Health data is excluded from AI prompts/traces; retain and verify that boundary separately from self-reported metrics. The terms still describe contacting support for deletion even though the native app offers deletion.

### 4. Account deletion can report success after partial failure — high priority

The native control exists at Settings → User Settings → Delete account (`src/app/settings.tsx:93`). The backend hard-deletes the database user, then catches a Clerk deletion failure and returns success (`apps/backend-node/src/routes/users.ts:349`). Authentication middleware can recreate a database user for a still-valid Clerk account (`middleware/auth.ts:47`). Stripe cancellation failures are also swallowed; the UI gives no indication that billing may continue.

Make deletion durable and retryable across systems, with honest pending/failure status. Verify uploaded-media cleanup and Apple authorization revocation through the identity provider; neither is established by database cascading. Run an end-to-end deletion test with a disposable account. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app).

## Other migration and submission checks

- **Apple Health V0 is implemented locally, pending release:** the Expo bridge now requests read access to Sleep/Workouts and provides connection, confirmation-based workout imports and an estimated Sleep score. Native simulator authorization/sync and local tests passed; see [V0 validation and limits](native-health-v0.md). The current hosted build 26 does not contain this flow. Deploy the backend and verify a new native build before advertising it as available. Physical Watch integration still needs device validation.
- **Push logout cleanup:** Expo registers raw APNs tokens correctly for the existing backend, and notification-tap navigation exists. Its logout only clears Clerk; it does not unregister the server's device token. Check account switching and prevent the previous account's notifications reaching a signed-out/shared device. Verify production APNs on the physical release.
- **Purpose strings:** the actual IPA has additional generic microphone, motion and always-location descriptions supplied by dependencies. Audit actual access; remove unnecessary requests/descriptions or explain the real purpose. Camera/photo/calendar purposes are present and specific.
- **Privacy manifests:** build 23 contains 19 manifests; the app manifest lists file timestamps, UserDefaults and system boot-time reasons, with an empty collected-data list. This is not proof of “no data collected” and does not replace App Store Connect privacy answers. Reconcile account IDs, contact information, uploads, location, messages, fitness/self-reported metrics, purchases and third-party processing with the actual binary. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/).
- **Sign-in:** Apple sign-in configuration and entitlement are present. Earlier recorded checks reached Google's login screen but did not complete production login. Exercise Apple Hide My Email, existing accounts, Google, recovery and logout on the release. [Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services).
- **Device matrix:** the binary supports iPhone and iPad, minimum iOS 17. Test iPad layout, iOS 17 fallbacks, permission denial, cold-start links, offline recovery and real camera/photo flows. The migration log explicitly leaves a photo-viewer first-close-tap issue unresolved; reproduce it before calling it fixed.
- **Packaging:** build 23 uses iOS SDK 26.5, above Apple's current minimum, but its ad hoc profile is for device installation, not App Store upload. A separate store-signed archive is needed. New age-rating answers and EU trader verification are account-side checks. [Current Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/).
- **Review access:** supply a working review account, accessible paid features and precise review notes; onboarding preview alone does not cover all authenticated functionality. Ensure screenshots and claims match the final Expo and Watch binaries. [Guidelines 2.1 and 2.3](https://developer.apple.com/app-store/review/guidelines/#performance).

## Verification performed

Inspected source/configuration and extracted build 23's Info.plist, privacy manifests and archive membership without modifying the binary. Read existing build/test evidence; did not rerun that entire historical suite. No real user account was deleted, no purchase was made and no live social content was posted. Source findings requiring runtime validation are identified above.

## Watch restoration validation

Build 26 includes the Expo native WatchConnectivity module, clean-prebuild target generation, the existing SwiftUI companion, guarded login/logout updates and offline credential retention. Migration validation also corrected the inherited missing icon, mismatched short version and React Native aggregation selecting the Watch privacy resource. The combined simulator app compiled and launched; the final physical IPA passed independent binary/profile inspection. Authentication and activity writes were not exercised against a real user account. No App Store submission was performed.
