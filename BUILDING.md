# Native iPhone builds

Read [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md) before building an iPhone test release.

User preference (September 13, 2026): build on the user's Mac, then return an HTTPS installation page that works from Safari on their iPhone, including over mobile data. Use production services. Do not spend Expo cloud build quota by default.

The default command is `pnpm --filter frontend-expo build:iphone`. It runs a local EAS build, verifies the signed IPA, and publishes an expiring installer link to private S3 storage. It never falls back to cloud builds. The latest local build and hosted installer is build 104, completed September 18, 2026; see `apps/frontend-expo/BUILDING.md` for the current artifact, link expiry and verification.

This preference also applies to `~/workspace/verycheapaudiobooks`, with that project's own identifiers, environment, signing, and storage. The proposed shared Codex rule is in [docs/local-ios-global-rule.md](docs/local-ios-global-rule.md). The shared preference is installed in `~/.codex/AGENTS.md`.
