# Native iPhone builds

Read [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md) before building an iPhone test release.

User preference (September 13, 2026): build on the user's Mac, then return an HTTPS installation page that works from Safari on their iPhone, including over mobile data. Use production services. Do not spend Expo cloud build quota by default.

The default command is `pnpm --filter frontend-expo build:iphone`. It runs a local EAS build, verifies the signed IPA, and publishes an expiring installer link to private S3 storage. It never falls back to cloud builds. Build 159 is verified and hosted with existing phone/Watch signing. It adds offline logging, workout graphs and delayed-photo notifications while preserving build 156. See the frontend build document for hosting status and exact artifacts. Build 145 used a now-revoked certificate; failed attempts 147 and 153 produced no IPA. See `apps/frontend-expo/BUILDING.md` for the artifact, verification and installation commands. Run local device builds sequentially: concurrent EAS jobs share provisioning-profile files.

TestFlight build 164 (coach roles + Garmin webhook-only, built from build 162's source) is uploaded and in beta testing for internal testers since September 24, 2026; see `apps/frontend-expo/BUILDING.md`. Before that, TestFlight build 160 was built locally from the deployed `origin/main` commit `f74c2815`, validated by Apple, uploaded, processed and approved for internal and external beta testing on September 23, 2026. The private external group has five email-invited testers, its public link is disabled, and the recipients still need to accept their invitations and install the app. See `apps/frontend-expo/BUILDING.md` for the exact IPA and verification record.

This preference also applies to `~/workspace/verycheapaudiobooks`, with that project's own identifiers, environment, signing, and storage. The proposed shared Codex rule is in [docs/local-ios-global-rule.md](docs/local-ios-global-rule.md). The shared preference is installed in `~/.codex/AGENTS.md`.
