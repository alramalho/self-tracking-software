# Activity follow-up drawers

The September 14, 2026 update restores the Expo post-log difficulty and metric drawers from the PWA implementations:

- `apps/frontend-vite/src/components/DifficultyLogPopover.tsx`
- `apps/frontend-vite/src/components/MetricsLogPopover.tsx`
- `apps/frontend-vite/src/components/MetricIsland.tsx`
- `apps/frontend-vite/src/components/MetricRatingSelector.tsx`
- `apps/frontend-vite/src/components/AppleLikePopover.tsx`

The reference uses an activity emoji or 64px metric icon, a centered 20px title, 14px explanation, 12px rounded difficulty/rating controls, 24px rounded metric islands, and a compact trailing Skip/Done group. Mobile inner padding is 40px (16px drawer wrapper plus 24px content). Native footer actions retain a minimum 44px touch target. Existing native content-sized drawers, safe close button and drag handle are reused. Follow-up note fields scroll into view as the keyboard changes the available height. A fixed Done bar above the keyboard dismisses it without submitting the form; this avoids the missing multiline input-accessory control observed during iOS validation. The metrics Skip action remains available before all ratings are filled, preserving the native dismissal flow; both Skip and Close save any selected ratings as before.

The icon springs in at 200ms with stiffness 200, followed by title at 300ms, description at 350ms, choices at 400ms and actions at 500ms. Reflection and daily notes fade/slide when revealed. Check-in indicators pulse in the user's accent. Reduce Motion suppresses entrance movement, pulsing and drawer slides. Animations use the native driver on iOS and stop on unmount.

Difficulty no longer saves immediately on option tap. Selecting a value highlights the row; Done sends the difficulty and private reflection. Hard/very-hard choices reveal coach reasons from the existing authenticated reflection-reasons endpoint. Easier choices allow optional reflection. Save failures retain all input; dismissal is disabled during saving. No backend change was required.

Metrics retain the original sequential-save retry guard: a later failure cannot duplicate previously saved ratings. After all ratings are selected, the daily-note field appears. Ratings/note errors remain visible in the same drawer. Production data is never written by automated tests.

## Validation

From `apps/frontend-expo`:

```sh
node node_modules/typescript/bin/tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/follow-ups.spec.ts e2e/logger.spec.ts
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/parity.spec.ts -g 'logs activity|metric|partial check-in'
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-wrapped-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=DARK node e2e/native/run.cjs --ios --follow-ups
```

Repeat native validation with `E2E_THEME=LIGHT`. The existing simulator binary supports these JS-only changes; new native dependencies require rebuilding it using BUILDING.md. New iPhone IPAs are always separately built with production configuration. Keep the native screenshot-settling waits. Maestro IDs containing a question mark must escape it because selectors are regular expressions.

Browser checks exercise selection before submission, suggested reasons, private notes, difficulty-save failure/retry, all three metric ratings, note reveal, and a late note-save failure without duplicate metric entries. Native checks cover the entire logging/photo/effort/reflection/metrics/note/completion flow and verify API payloads. Evidence and the exact current release remain recorded in `apps/frontend-expo/BUILDING.md`.
