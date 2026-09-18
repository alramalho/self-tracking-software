# verycheapaudiobooks — local iPhone workflow handoff

Installed as `/Users/alramalho/workspace/verycheapaudiobooks/BUILDING.md` with an AGENTS.md pointer on September 13, 2026. The global preference is also installed. App-specific release automation has not been implemented or run for verycheapaudiobooks.

Use the same user flow as tracking.so: compile a signed release on the Mac, upload an IPA plus installation manifest/page to private HTTPS storage, and return a Safari Install link. Keep project-specific code and BUILDING.md in that repository. The shared preference should be installed globally from `local-ios-global-rule.md`.

Verified project settings:

| Setting | Existing value |
| --- | --- |
| Expo / React Native | SDK 57 / RN 0.86.3 |
| EAS project | `79f4e7de-98ef-4e02-92b1-b8846147d206` |
| Owner / slug | `alramalho` / `verycheapaudiobooks` |
| iOS bundle | `com.verycheapaudiobooks.app` |
| Internal profile | `preview` (internal, autoIncrement) |
| Production API env | `EXPO_PUBLIC_API_URL=https://verycheap-audiobooks.62.238.118.235.sslip.io` |
| Native behavior to preserve | Background audio playback |

Intended local build command from that repository, after toolchain and signing verification:

```sh
npx eas-cli@24.0.0 build --platform ios --profile preview --local --non-interactive --output /absolute/path/to/verycheapaudiobooks.ipa
```

This command has **not** been run here. First confirm the existing EAS login/signing profile includes the user's iPhone, pin the intended public environment and verify the resulting bundle. The appropriate storage location and Apple signing team were not inspected/verified. Do not import tracking.so's Clerk config, HealthKit/AppGroup entitlement checks or S3 destination by assumption.

The project has a `postinstall` script named `patch-expo-modules-jsi.mjs`; inspect what it does before changing it. Updating the shared Mac to supported Xcode 26.4+ is preferred to adding another workaround. Only BUILDING.md and an AGENTS.md pointer were added to verycheapaudiobooks; existing local app changes were preserved.

Reference implementation to adapt after access is available: tracking.so's `apps/frontend-expo/scripts/iphone/`. The current verifier is intentionally app-specific. Do not blindly copy it unchanged.
