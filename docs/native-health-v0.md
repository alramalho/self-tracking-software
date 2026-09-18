# Apple Health and Watch integration V0

## Workout vitals and detection — September 16, 2026

- A linked workout stays attached to its tracking.so activity. Profile and timeline cards add one compact Apple Watch row with average heart rate, calories and duration when available; the owner can open the full workout details from that row.
- The detail view shows only supplied values: duration, precise distance, derived pace, active calories, average/maximum heart rate and Apple/user effort. Missing signals do not create empty tiles.
- Watch data is private by default. Workout review has a single privacy summary row; **Share with activity** is an explicit choice. Friends receive no Health-derived exact timing, distance, duration or vitals unless that choice was made.
- HealthKit workout observer delivery requests `.immediate` background updates. When iOS wakes the app after a new workout and notification permission already exists, a local **Workout detected** notification opens `/health?review=1`. Foreground activation still performs the reliable sync fallback and the Home card opens the same continuous batch review.
- Background delivery is best effort. iOS controls scheduling, and protected Health data can be unavailable while the phone is locked. Physical-device notification timing remains a real-device validation item.

## Initial implementation status — superseded by build 29 below

Implemented locally in Expo and the backend. Combined iPhone/Watch simulator compilation passed with the new `TrackingHealth` module and existing `TrackingWatch` module. The installed/hosted production release is still **build 26**, which contains the Watch companion but **does not contain this new Health connection, workout review or sleep score**. No backend deployment, new IPA, OTA or store submission was made for V0.

The physical Watch transfer/Developer Mode follow-up belongs to build 26 and remains separate; see the current status in [the build guide](../apps/frontend-expo/BUILDING.md). Simulator success does not establish paired-device installation, authentication or real Watch data availability.

## In-app flow

1. **Settings → Apple Health → Connect Apple Health.** Explain that permitted workout and sleep records are saved to the tracking.so account. iOS asks for read access to Workouts and Sleep only. Connection is optional; a completed permission sheet does not prove that either read permission was granted.
2. **Sync.** Initially look back 30 days. Subsequent foreground/manual checks use HealthKit anchors and refresh the last 14 days. Upload in batches of at most 100 records per type. Commit anchors only after every batch succeeds. There is no immediate/background delivery promise; Watch records must first arrive in Health on the paired phone.
3. **Home → “Review workouts”.** Open the matching drawer directly. A list of all pending workouts is also available on the Health screen. Discovery never interrupts the user with an automatic modal.
4. **Confirm, choose or create.** Suggest a matching existing log or remembered activity. Keep the manual quantity by default; explicitly choose the Apple measurement to replace it. Notes/photos remain. Choose another compatible activity, create an activity with a prefilled name and minutes/kilometers/sessions, or skip. Ambiguous matches require an explicit selection. Confirmed imports persist and repeated confirmation cannot create another log.
5. **Metrics → Sleep score.** Show the latest night, seven recent recorded dates and a duration/consistency/interruption breakdown. Learning or incomplete nights show no total; they are never presented as zero. The API retains the latest 60 derived nights for retrieval.
6. **Disconnect.** Stop syncing on this phone and either keep imported history or remove it. Removal deletes raw imports, derived scores and activity entries created by import; linked manual entries remain, including a quantity the user explicitly chose to replace. Their Health provenance remains excluded from the coach activity queries. Deletion also clears already viewed Health results from memory.

### Examples

- Apple records a 5.1 km run and a 5 km Running log exists: link to the existing log and count it once. The activity schema currently stores integer quantities, so choosing Apple's value records **5 km**, explicitly previewed in whole units. Raw 5.1 km remains with the Health workout. Fractional logging would require a separate schema/product change.
- Apple records 40 minutes of strength training: after the user previously chose Gym for that Apple workout type, suggest Gym again. It still needs confirmation.
- A new swimming workout has no relevant activity: prefill Swimming, show a compatible unit and resulting quantity, then create the activity and log atomically.
- Two plausible runs exist that day: select neither automatically; show both times and require the user's choice.

## V0 sleep model

This is a transparent wellness estimate, not Apple's proprietary score, not calibrated against the user's screenshots and not clinically validated. Research supports the input dimensions, not these exact weights or thresholds. See [research and calibration](sleep-score-research.md).

Algorithm version: `tracking-sleep-v0`. `clamp(x)` bounds a value between zero and one.

- Duration: `round(50 × clamp(asleepMinutes / 480)²)`. Eight hours is a provisional reference, not an individual prescription. Longer sleep does not accumulate extra points.
- Bedtime consistency: `round(30 × clamp(1 − bedtimeDeviationMinutes / 180))`. Compare with the circular medoid of up to 13 prior nights within 21 days, with at least seven prior nights in the same timezone. Circular distance handles midnight; this is not the research Sleep Regularity Index.
- Interruptions: `round(20 × clamp(1 − awakeMinutes / 90 − sustainedAwakenings / 20))`. Count contiguous recorded awake intervals lasting at least five minutes.
- Total: sum the components only when coverage is at least 95%, detailed stages/awake data support continuity, and the bedtime baseline exists. Otherwise preserve measurements and nullable component/total values.

Overlapping records are merged within a source/product; awake overrides asleep where contradictory intervals overlap. Competing sources are not added together. The longest eligible session is selected for each local wake date. Sessions separated by more than 90 minutes are split; each needs at least 60 asleep minutes and must span at most 24 hours. Recent sessions need to have ended at least 30 minutes ago. A nap or separate split-sleep block does not add to the primary session. These are deliberate V0 limitations for later calibration, including unusual schedules and competing trackers.

Raw samples and derived component metadata/algorithm version persist in existing Health tables; **no Prisma migration is required**. Incomplete records use nullable metadata totals; the required numeric storage field's placeholder is never the API/displayed score. Derived scores are recomputed on a successful final batch, including after sample deletion. This currently scans retained sleep history per account; benchmark/incrementally recompute if import history grows materially.

## Data boundaries

Native anchor storage is separated by a hashed account key. Each upload captures the account's bearer token and stops later batches on account change. The Health cache is not included in the normal persisted query allowlist. Scoring and matching use deterministic local/backend code, without an external AI request.

The coach agent, assessment, context brief and concern-detector activity queries explicitly exclude imported or Health-linked logs through `healthSafeActivityFilter`. Source provenance remains after imported-history deletion. This is a targeted boundary for these activity queries, not a claim that every AI feature or App Store privacy requirement has been audited.

## Validation and exact commands

From `apps/frontend-expo`:

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/health-upload.test.ts
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/health.spec.ts
```

Seven browser scenarios passed across the review and deletion runs. The browser tests cover dark/light review and score breakdown, failed-request retry, create/choose/skip, direct Home drawer access, ambiguous selection and clearing removed sleep history. Upload tests cover empty final batches, deletion batching, account changes and failed uploads.

From `apps/backend-node`:

```sh
pnpm exec tsc --noEmit
pnpm exec vitest run src/services/health/apple/sleep/model.test.ts src/services/health/apple/reconciliation/service.test.ts src/services/health/apple/reconciliation/preferences.test.ts src/services/health/apple/reconciliation/schemas.test.ts
DATABASE_URL=postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test DIRECT_URL=postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test pnpm exec vitest run src/services/health/apple/sleep/service.integration.test.ts src/services/health/apple/reconciliation/service.integration.test.ts
```

Thirty backend model/reconciliation unit tests, three upload tests and five local persistence tests passed. The persistence tests guard the exact isolated local database; never point them at production. They cover nullable/updated/deleted sleep scores, atomic custom activity creation under concurrent confirmation, linked manual log preservation and its exclusion from coach activity queries after deletion.

Native compile uses the combined iPhone/Watch command already in [BUILDING.md](../apps/frontend-expo/BUILDING.md). From `apps/frontend-expo`, after compiling and booting the selected simulator:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-watch-phone-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=LIGHT node e2e/native/run.cjs --ios --health
```

Native review/sleep UI passed in DARK and LIGHT. The final LIGHT run also requested actual HealthKit authorization for Sleep/Workouts and uploaded a native prepared batch to the local fixture server. Workout/sleep display records were fixture data; no real Watch health records or production services were used. Native screenshots were inspected. Evidence:

- Combined compile: `/private/tmp/tracking-health-native.log`.
- Native DARK review: `/private/tmp/tracking-health-native-DARK.log`, captures `apps/frontend-expo/test-results-native-ios/2026-09-15_160102/health-ios/`.
- Native LIGHT authorization/sync/review: `/private/tmp/tracking-health-native-LIGHT-final.log`, captures `apps/frontend-expo/test-results-native-ios/2026-09-15_160321/health-ios/`.
- Browser review flows: `/private/tmp/tracking-health-browser-final.log`; deletion: `/private/tmp/tracking-health-delete-browser.log`.
- Unit and local database evidence: `/private/tmp/tracking-health-unit.log`, `/private/tmp/tracking-health-db-final.log`, `/private/tmp/tracking-health-sleep-db-final.log`, `/private/tmp/tracking-health-upload.log`.

## Release follow-through

For a requested device release, deploy and verify the scoped backend changes, then use the documented local production build/verification/hosting workflow. Verify the actual new IPA has `TrackingHealth`, the permission text, existing Watch payload and new JS screens before returning its installer. Build 26 cannot acquire this native module through JavaScript alone.

On the user's paired devices, verify Watch launch/authentication, a real workout reaching Health, matching without a duplicate, overnight sleep availability and reconnect/deletion behavior. Screenshots of Apple Sleep Score can later inform calibration; they are not needed to use V0 and cannot establish exact equivalence to Apple's model.


### September 15 release follow-up

The Health backend is now deployed as part of `local/tracking-so-backend:interview-health-20260915`, derived from the current Watch-ordering/notification image. All scoped source hashes and authenticated routes were verified. The final combined unit suite passed 39 cases and the isolated Health persistence suite passed five cases. See the backend runbook for deployment/rollback, and frontend BUILDING.md for the actual new IPA status. Earlier statements that no backend deployment occurred describe the initial implementation, not this follow-up.

The Health module and screens are now included in verified and hosted production build 29. Actual IPA and hosted checksum checks passed; see frontend BUILDING.md for exact paths and commands. The user reported the preceding Watch companion working. Real workout/sleep import remains a paired-device follow-up.

## Workout drawer hierarchy follow-up — September 15, after build 29

The matching drawer now separates editing a proposed match from committing it. Its default view has a compact icon/workout summary, editable match and amount rows, one neutral primary **Link workout** action and a quiet **Skip this workout**. Alternatives and amount choices open focused views within the same drawer. Selected choices use checkmarks; navigation uses chevrons. Creating an activity keeps the one **Create and log workout** action. Date seconds and device-name copy no longer compete with the decision. Existing reconciliation payloads, integer quantities, conflict checks, retry and duplicate prevention are retained.

An independent agent inspected the supplied before screenshot, actual PWA editor captures and the PWA goal-reason/logger/action components, then the revised browser/native screenshots. It supported the hierarchy change, identified alignment/icon/copy refinements that were applied, and recommended the four short rules now in AGENTS.md. This validates the specific comparison, not a guarantee that instructions alone ensure future design quality. No additional design framework was introduced.

Validation: frontend TypeScript and eight browser Health cases passed, including create/choose/skip, conflicts, failed-save retry and changing the amount without a write until the final action. Native iOS LIGHT and DARK flows passed; DARK additionally checks creation input, visible keyboard Done, returning to the existing match and exactly one reconciliation. Actual native screenshots were inspected. Tests use local fixtures and simulator Health authorization, not production data writes.

- Browser: `/private/tmp/tracking-workout-design-browser-verified.log`; captures in `apps/frontend-expo/test-results/workout-review-DARK.png`, `workout-review-LIGHT.png`, `workout-amount.png`, `workout-choose.png`.
- Native LIGHT: `apps/frontend-expo/test-results-native-ios/2026-09-15_184615/health-ios/`; log `/private/tmp/tracking-workout-design-native-LIGHT-final.log`.
- Native DARK, including keyboard: `apps/frontend-expo/test-results-native-ios/2026-09-15_184848/health-ios/`; log `/private/tmp/tracking-workout-design-native-DARK-verified.log`.
- Repeat with `pnpm exec tsc --noEmit`, `node node_modules/@playwright/test/cli.js test e2e/health.spec.ts` and `node e2e/native/run.cjs --ios --health` using the simulator environment documented above. Run browser and native Metro sessions sequentially to avoid development refresh banners in screenshots.

This follow-up is included in verified and hosted local production build 30. The actual signed IPA contains the new hierarchy markers, and the complete hosted download matches its local SHA-256. Build 29 does not contain the simplified drawer. No OTA was published.

## Match clarity follow-up — included in build 31

The chooser now presents the Apple Watch workout as a distinct source card before any choices. Possible existing logs show both their relative calendar date and relationship to the Watch event, such as **Same day as Watch · Today** or **1 day before Watch · Yesterday**. The second section is titled **Or create a new log**; every compatible activity says **New log**, and the explanatory copy states that choosing it creates a separate log. The preview API has no activity-entry photo URL, so this release uses truthful activity-specific icons rather than a placeholder image.

Two focused date tests, eight browser Health cases and full DARK/LIGHT native flows passed. The final native chooser screenshots are `test-results-native-ios/2026-09-15_200041/health-ios/takeScreenshot/health-workout-choose.png` and `2026-09-15_200151/health-ios/takeScreenshot/health-workout-choose.png`. Verified and hosted local production build 31 contains the new labels and Watch source card; its exact artifact and distribution metadata are recorded in frontend BUILDING.md. No OTA or App Store submission was performed.

## Precise connected measurements — included in build 32

Manual logging continues to use integer `ActivityEntry.quantity` values for fast input, progress and scoring. Apple Health imports already retain the source workout separately and copy its exact `distanceMeters`, `startedAt`, `endedAt` and rounded whole-second duration onto the linked activity entry. The timeline now uses those connected fields for presentation: 6,300 m appears as **6.3 km** with **39 min**, while a manual six-kilometre entry continues to appear as **6 kilometers**. No quantity schema migration or decimal keypad was added.

Workout-level active energy remains on `HealthWorkout`. Build 33 adds the separately reviewed workout effort and heart-rate summaries described below; neither becomes part of the public activity quantity.

Frontend TypeScript, all 52 model tests and four mobile timeline browser cases passed. Hosted build 32 was downloaded and verified byte-for-byte against the signed local IPA; exact artifact and installer metadata are recorded in frontend BUILDING.md.

## Workout effort and heart-rate summaries — included in build 33

On iOS 18/watchOS 11 or later, HealthKit exposes a user's workout effort score, Apple's estimated workout effort score and the relationship between those values and a workout. Sync now requests those types plus heart rate, re-reads the recent workout window so an effort score added after the workout can enrich an existing import, and uploads optional user/estimated effort plus average/maximum workout heart rate. Older OS versions keep the previous workout import behavior.

Reconciliation prefers the user's Apple effort score, then Apple's estimate. Scores map deterministically from Apple's 1–10 scale to the existing five choices: 1–2 very easy, 3–4 easy, 5–6 moderate, 7–8 hard and 9–10 very hard. A linked entry receives that value only when its difficulty is empty; a prior tracking.so answer is preserved. A new imported entry receives the mapped value at creation. Heart rate is retained as supporting private workout metadata and displayed as a compact average when present. It does not determine difficulty on its own because personal zones and reliable maximum/resting baselines are not yet available.

The review surface adds no new decision. Effort appears as a quiet line such as **Your effort · Hard** or **Watch estimate · Moderate**. Build 36 places heart rate on a separate row with a heart icon and explicit provenance such as **Apple Health · 151 bpm average**. If Health provides none of these optional fields, the lines are absent and the existing manual **How hard was it?** flow remains available. Manual integer activity input is unchanged.

Backend/frontend TypeScript, 17 backend schema/effort/persistence tests and nine frontend effort/date tests passed. Native simulator compilation passed against the iOS 26.5 SDK. The signed build 33 IPA was checked for `HKWorkoutEffortRelationshipQuery`, both effort type identifiers, heart-rate import, the updated Health permission text, the bundled UI markers, matched phone/Watch build numbers and release signing. The hosted IPA matches its local SHA-256. Exact artifact, publishing commands and verification reports are in frontend BUILDING.md. The production backend retains the scoped `health-effort-20260915` layer beneath the current people-ordering overlay, with no database migration; deployment and rollback details are in `hetzner/MIGRATION.md`.

## Compact Home prompt and continuous batch review — included in build 36

The Home prompt is now a compact, tappable row with a Health icon, pending count, one-line batch explanation and chevron. The large explanatory panel and two equal **Review workouts** / **See all workouts** buttons were removed. This follows the app's established hierarchy: one clear action, icons that carry meaning, and Home content remaining visually dominant.

Opening the row snapshots the current pending workout queue. The drawer shows **Workout N of M** with a thin progress bar. A successful Link, Log or Skip invalidates Health/activity/timeline data, resets the form for the next workout and advances within the same open drawer. The drawer closes after the last decision or when the user explicitly closes it. Starting from a specific workout on the Apple Health settings screen reviews that workout first, followed by the other pending items. Retry behavior remains on the current workout after a failed save.

Frontend TypeScript, five focused model tests and all nine Health browser cases passed. Full native iOS flows passed in DARK and LIGHT with a two-workout fixture, including the Home row, progress, automatic transition, explicit Apple Health BPM line, amount/match/create subflows, final dismissal, sleep regression and actual simulator Health authorization/sync. Screenshots were inspected at `apps/frontend-expo/test-results-native-ios/2026-09-16_095223/health-ios/takeScreenshot/` and `2026-09-16_095331/health-ios/takeScreenshot/`. The signed and hosted build 36 artifact contains the compact prompt, progress and BPM markers; exact paths and checksums are in frontend BUILDING.md.

## Default best match and focused conflict handling — included in build 37

When reconciliation returns one plausible existing log, the workout drawer now selects it immediately. A quantity difference such as a six-kilometre manual log versus 6.3 km from Apple Health does not force a separate match-choice step; the main drawer still makes both the selected log and editable amount explicit before the single final **Link workout** action. **Change workout match** remains available.

The automatic choice is withheld for `ambiguous_match`, `possible_duplicate` and `unit_incompatible`. Those cases open the existing **Choose a match** view directly, show the backend conflict reason and require a row selection before returning to the main review. This reuses the current drawer pages. The backend already restricts candidates to the same local calendar day and a semantically compatible activity or a previously confirmed user mapping.

Seven focused frontend model tests and all nine Health browser cases passed. The browser suite covers both a quantity mismatch that keeps the best candidate selected and an ambiguity that opens the chooser. Full native DARK/LIGHT flows used the same quantity-mismatch fixture and passed; the main drawer screenshots were inspected at `apps/frontend-expo/test-results-native-ios/2026-09-16_132757/health-ios/takeScreenshot/` and `2026-09-16_132855/health-ios/takeScreenshot/`. Verified and hosted build 37 contains the selection helpers and conflict-code markers in the actual production JS bundle. Exact IPA, signature, provisioning and hosted checksum evidence is in frontend BUILDING.md.
