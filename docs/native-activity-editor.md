# Native activity editor parity

## Change — September 15, 2026

The Expo edit/add activity drawer now follows the PWA `ActivityEditor`, `SteppedColorPicker`, `EmojiInput`, `AppleLikePopover` and confirmation components. This change is included in verified and hosted local production build 29. No OTA was published.

- Content-sized bottom drawer, left-aligned title, handle and close control, compact emoji/title/measure inputs in PWA order.
- Expandable Activity Color selector with all 17 PWA colors, three intensity swatches, selected checkmark and Automatic (based on plan). An existing custom color remains visible and is preserved. No raw hex text field.
- Theme-neutral Save button and red trash-icon Delete button, using the PWA backgrounds, rounded controls and spacing. Native controls retain 44-point minimum touch targets and safe-area clearance.
- Changing a measure opens a separate conversion confirmation after Save. The default operator is division, with a positive whole-number factor, a 60-unit example and a fractional-quantity warning. Cancel returns to the edited form without saving.
- Delete has its own confirmation explaining associated data removal; Cancel preserves edits. Pending actions disable confirmation, controls and dismissal. Server failures remain visible for retry.
- Creating an activity still requires a title, measure and one emoji. Emoji validation follows the PWA helper. A keyboard Done bar is shown on iOS; this form opts out of the logger's automatic scroll-to-bottom behavior so upper inputs stay visible.

Implementation: `apps/frontend-expo/src/features/activities/ActivityEditor.tsx` and `editor/`. The shared `LoggingDrawer` gained an optional `scrollToEndOnKeyboard` flag, defaulting to its existing behavior; this editor sets it to false.

## Comparison and validation

The actual PWA components/CSS were rendered in an isolated local Vite harness, with only the activity/theme hooks replaced by fixtures. Reference images are in the ignored `apps/frontend-expo/.release/activity-editor-reference/` directory (`pwa-DARK.png`, `pwa-LIGHT.png`, and expanded palette counterparts). They are reference renders, not screenshots of a signed-in production account. The native screens and reference images were visually inspected in both themes.

Six browser scenarios passed across the final runs: dark/light layout and palette with failed-save retry, conversion preview/cancel/save, deletion cancellation, confirmed-deletion failure/retry, and new-activity validation/save. Final suite evidence is `/private/tmp/tracking-editor-browser-complete.log` (five passed; Chrome closed during the first test before interactions) and `/private/tmp/tracking-editor-browser-dark-final.log` (the affected DARK case rerun). TypeScript passed in `/private/tmp/tracking-editor-typecheck-final.log`.


Native DARK and LIGHT flows passed with real iOS input controls and local fixture services. They exercise palette selection, deletion cancellation, the keyboard Done control, division/multiplication toggle, conversion factor replacement, preview and one save. The runner checks the exact conversion payload, Automatic color as null, one upsert and zero DELETE requests. Native screenshots are under `apps/frontend-expo/test-results-native-ios/2026-09-15_164900/activity-editor-ios/` (DARK) and `apps/frontend-expo/test-results-native-ios/2026-09-15_165223/activity-editor-ios/` (final LIGHT), recorded in `/private/tmp/tracking-editor-native-LIGHT-final.log`. Intermediate failed runs caught the missing native Done control and a test input replacement issue; both were resolved before completion.

From `apps/frontend-expo`:

```sh
pnpm typecheck
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/activity-editor.spec.ts
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 \
MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro \
E2E_IOS_APP=/private/tmp/tracking-watch-phone-simulator/Build/Products/Debug-iphonesimulator/trackingso.app \
E2E_THEME=LIGHT node e2e/native/run.cjs --ios --activity-editor
```

Use DARK for the other theme. The existing simulator development bundle was reused with the current JavaScript; this change adds no native dependencies. The separately compiled production build 29 includes this change. Follow `apps/frontend-expo/BUILDING.md` for the exact verified IPA, hosted release metadata and repeatable commands.
