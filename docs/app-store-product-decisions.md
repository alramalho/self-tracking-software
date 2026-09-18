# App Store product decisions — September 15, 2026

These decisions record the user's direction. They are not a claim that the features are implemented or released.

## Confirmed direction

- Add Apple in-app subscriptions for coaching. Recognize existing web subscriptions. Keep commercial terms separate from implementation; exact Apple pricing/trial and product configuration remain to be resolved from the existing offer and owner input.
- Manual tracking remains usable when AI sharing is declined. Explain recipients and data before enabling coaching; enforce consent in backend requests and background jobs. Allow withdrawal. Preserve the existing exclusion of imported Apple Health data from external AI prompts and traces.
- Explain social moderation to the owner before treating ownership as confirmed: reports concern abusive users/content, rather than ordinary product feedback. Proposed implementation is contextual Report and Block controls plus an owner-only review queue, with Get help in Settings separately. Filtering and timely operational responses are also required.
- Apple Health is optional for initial App Store release, but the desired integration is simple workout detection, suggested matching and explicit confirmation in a bottom drawer. Provide Create activity when needed.

## Workout examples and proposed interaction

After the user connects Apple Health, surface a non-blocking card when new workouts are discovered. Start with checks when the app opens or returns to the foreground; do not promise immediate background detection. The card opens a review drawer on tap, rather than interrupting the current screen automatically.

1. **Already logged:** Apple Health has a 5.1 km run at 07:30; tracking.so has a 5 km Running entry that morning. Suggest that entry. Confirm links the workout without another completion or silently changing the logged value. Offer an explicit option to use Apple's measurement, previewed as 5 km under the current whole-number activity schema; retain the original 5.1 km in Health records.
2. **Activity exists, entry does not:** Apple Health has a 40-minute bike ride; Cycling exists in tracking.so but has no entry that day. Suggest logging it under Cycling, showing the quantity and unit before confirmation.
3. **No suitable activity:** Apple Health has a swimming workout and no compatible activity exists. Offer Create activity with a prefilled name and compatible unit, then log the workout after confirmation. Keep Choose another activity available.
4. **Ambiguous:** Two same-day runs could match. Show time and distance for both candidates and ask the user to choose. Same-day presence alone never establishes a match.
5. **Already handled or unwanted:** A confirmed workout stays resolved across subsequent syncs. Provide Skip for unwanted imports. Repeated taps and sync retries must not create duplicates.

Matching should use workout type, local date/time, compatible units and available distance/duration. This is deterministic matching and does not require sending Health data to an external AI service. Preserve source provenance when a workout is linked or imported.

### Saved choices and sleep — additional user direction

**Latest decision:** The user now authorizes our own calculated sleep score and offers Apple screenshots for model investigation. This supersedes the earlier exact-Apple-only restriction below. See [research and calibration plan](sleep-score-research.md). We will distinguish a tracking.so estimate from an imported Apple score; no calibration data has been supplied yet.

The user wants workout matches retained and Sleep quality available as a new metric. Confirmed workout links already persist; the backend now reuses those stored choices in subsequent previews. For each exact Apple workout type, the latest usable confirmed activity is preferred, including custom activity names. The user must still confirm the next workout. Deleted/unavailable activities, ignored workouts and incompatible measurements do not supply a preference. Two plausible same-day entries remain ambiguous. No database migration is needed for this implementation; it derives the preference from existing reconciliation records. It remains a local source change pending backend deployment and a new native release.

Example: confirm Traditional strength training → Gym once. Next time, Gym is suggested, while the user can still select another activity. Each confirmed workout retains its own link and imported measurements.

Earlier, the user selected Apple's own Sleep Score. That restriction is superseded by their approval to implement our own V0. Apple's Developer Technical Support [reported no public score API](https://developer.apple.com/forums/thread/800403); the installed SDK check likewise found no public declaration. V0 uses public sleep samples, retains their provenance and clearly labels the result as tracking.so's estimate. Do not use private AppleSleepScore symbols or claim the value is imported from Apple.

The Expo HealthKit connection, Home workout drawer, persisted matches/custom activity creation and calculated Sleep score are now implemented locally. [The V0 guide](native-health-v0.md) records the formula, flow, integer-quantity limitation, tests and release boundary. Simulator validation passed; the new flow is not deployed or included in installed build 26.

Validation for saved suggestions: reconciliation service, preview and schema unit tests, plus backend TypeScript. No production data or subscription configuration was changed.

## Existing implementation to reuse

The backend already has Apple workout reconciliation preview/apply routes and matching helpers under `apps/backend-node/src/services/health/apple/reconciliation/`. Actions include `link_keep`, `link_use_health`, `import_new` and `ignore`; previews include suggestions, ambiguous matches and measurement differences. Validate these against the examples before adapting them to the Expo interface. The new Expo native connection and user-facing flow are implemented locally and documented in the V0 guide.

The current coaching offer reads the production Stripe payment link in `apps/backend-node/src/services/follow-through/onboarding/billing.ts`. Do not invent a price or trial. Apple purchase UI should use localized StoreKit product data and verified server entitlements, with restore/manage subscription paths and duplicate-subscription protection.

## Independent engineering work

Reliable and retryable deletion, logout push-token cleanup, accessible policy/support links, accurate permission requests, migration bug fixes and submission evidence can proceed independently of outstanding commercial or moderation-owner inputs. Physical Watch installation failure is a separate open release issue.

## Sources

- [Apple review guidelines — user-generated content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [Apple review guidelines — in-app purchase](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [Apple HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
