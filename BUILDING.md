# Native iPhone builds

Read [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md) before building an iPhone test release.

User preference (September 13, 2026): build on the user's Mac, then return an HTTPS installation page that works from Safari on their iPhone, including over mobile data. Use production services. Do not spend Expo cloud build quota by default.

The default command is `pnpm --filter frontend-expo build:iphone`. It runs a local EAS build, verifies the signed IPA, and publishes an expiring installer link to private S3 storage. It never falls back to cloud builds. Build 159 is verified and hosted with existing phone/Watch signing. It adds offline logging, workout graphs and delayed-photo notifications while preserving build 156. See the frontend build document for hosting status and exact artifacts. Build 145 used a now-revoked certificate; failed attempts 147 and 153 produced no IPA. See `apps/frontend-expo/BUILDING.md` for the artifact, verification and installation commands. Run local device builds sequentially: concurrent EAS jobs share provisioning-profile files.

TestFlight build 168 (coach roles, Garmin webhook-only, homepage plan state, silent nudges, at-risk weeks and the warning sheet) is in beta testing for internal testers since September 25, 2026; build 164 was expired after crashing on launch because its package lacked the native modules; see `apps/frontend-expo/BUILDING.md`. Before that, TestFlight build 160 was built locally from the deployed `origin/main` commit `f74c2815`, validated by Apple, uploaded, processed and approved for internal and external beta testing on September 23, 2026. The private external group has five email-invited testers, its public link is disabled, and the recipients still need to accept their invitations and install the app. See `apps/frontend-expo/BUILDING.md` for the exact IPA and verification record.

This preference also applies to `~/workspace/verycheapaudiobooks`, with that project's own identifiers, environment, signing, and storage. The proposed shared Codex rule is in [docs/local-ios-global-rule.md](docs/local-ios-global-rule.md). The shared preference is installed in `~/.codex/AGENTS.md`.

## Standalone 3D onboarding — September 30, 2026

The selected `tracking-circles` onboarding uses the original 3D artwork without colored backplates and the original target Lottie on Welcome and Goal. “I’m ready!” fades the Welcome body into a second part asking for age with the weekly-frequency number control. Continue saves age before Goal, so matching can reuse it. The requested introduction, overview cards, commitment and **I'm ready!** CTA remain. The target loops gently on both screens; Reduce Motion shows its static target. Every screen change uses quick progressive fades from top to bottom. The [real-screenshot HTML walkthrough](docs/reviews/onboarding-2d/index.html) compares all 16 steps in light/dark (62 captures; the new age step has no original equivalent), plus actual light/dark motion recordings, with the earlier emoji/Lucide report preserved beside it. Local build 184 failed at archive signing because the app's phone/Watch profiles do not include the selected certificate. No new IPA or installer exists for this source update. See the frontend build document for checks and signing recovery.

## Latest Safari-install release — build 205, October 2, 2026

Build 205 from main `d3bf7bf9` has everything on main: the streak explainer, dictation feedback and languages, the missed-week sheet, the smooth heart-rate chart, account switching and the Metrics redesign. Verified and hosted; the link expires October 9. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#safari-install-build-205--everything-on-main-plus-the-streak-explainer-october-2-2026).

## Earlier Safari-install release — build 188, September 30, 2026

Circle encouragement is deployed on the web and backend, and local signed iPhone/Watch build 188 is verified and hosted. Source `9cce3691` combines the approved encouragement change `0022291e` with existing main `eda9fab9`; opening the member hand opens a personal composer, and sending explicitly delivers a private message. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#safari-install-build-188--circle-encouragement-september-30-2026) for exact commands, artifacts and verification. This is a Safari test release; the recorded TestFlight release remains 177.

## Latest TestFlight release — build 204, October 2, 2026

Build 204 from main `d3bf7bf9` is build 203 plus the streak explainer: tapping a flame under a plan's grid opens a short visual drawer on how a week moves the streak, with the plan's own last weeks. The same commit is hosted as Safari-install build 205. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#current-testflight-release--build-204-october-2-2026).

## Previous TestFlight release — build 203, October 2, 2026

Build 203 from main `eb879929` is the first build with all of October 2's work together: the smooth heart-rate chart, account switching, the Metrics redesign and the dictation feedback from the merged `voice-feedback` branch. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#previous-testflight-release--build-203-october-2-2026). Builds 198 to 202 each lacked something and are superseded.

## Metrics redesign — on main, on the web and in TestFlight build 203, October 2, 2026

The Metrics page now states what it found in one sentence from the coach, with same-day findings, real percentage differences and signal strength. It is on main, live on the web app, and in TestFlight from build 203. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#metrics-redesign--on-main-and-on-the-web-in-testflight-from-build-203-october-2-2026).

## TestFlight build 200 — account switching, October 2, 2026

Build 200 from main `dfaa222b` adds account switching (Settings → Accounts) to build 197. It lacks the dictation features of build 199, which was built from the unmerged `voice-feedback` branch; build 201 combines both and is validated but not uploaded. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#testflight-builds-200-and-201--account-switching-october-2-2026).

## TestFlight build 199 — dictation feedback, October 2, 2026

Build 199 from `cead058d` (main `f64f0e68` merged with branch `voice-feedback`) adds the dictation feedback banner, the languages people speak, the explained missed-week sheet and the clay coach figures, and keeps build 197's smooth heart-rate chart. It needs the `voice-languages-20261002` backend, which is live. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#current-testflight-release--build-199-october-2-2026). Build 198 was uploaded an hour earlier without the heart-rate chart and is superseded; build 197 (smooth heart-rate chart) and 195 (circle momentum, in-app invites, drawers) came before.

## Earlier TestFlight release — build 192, October 1, 2026

Coached outcome plans (outcome/consistency goals, two routes by Helly and Oli, two reviewed weeks, paywall table) are live on the backend (`plan-design-20261001`) and uploaded to TestFlight as build 192 from `a30dc209`. See [apps/frontend-expo/BUILDING.md](apps/frontend-expo/BUILDING.md#current-testflight-release--build-192-october-1-2026). The Vite web app is unchanged by this release.
