# Native onboarding: guided interview and settings parity

## Experience

The Expo onboarding now follows the original PWA's extraction → confirmation → tailored next question pattern. Reference sources are `PlanGoalSetter`, `DynamicUISuggester`, `PlanProgressInitiator`, `CoachingSelector`, `PlanGenerator`, `ProgressBar` and the original onboarding container/step actions in `apps/frontend-vite/src`.

Five visible sections: **Your goal → Starting point → Your week → Your support → Your plan**. The goal includes motivation, the starting point covers current experience/routine and useful obstacles/resources, and the weekly rhythm must reflect an explicitly chosen frequency and session length. Coaching is recommended only with a reason tied to the answers; the user chooses it or simple tracking. The final plan remains a proposal until confirmed. Coaching then offers the existing configured trial/subscription, with free tracking as an alternative preserving the same plan.

Every submitted answer and choice, including plan corrections, calls the same authenticated `/follow-through/onboarding/interview` semantic gate. It checks relevance, concreteness and consistency with earlier answers. Clarifications remain within the current progress section. Nonsense and instruction-override attempts do not advance; typos, informal wording and sincere profanity do not themselves cause rejection. There is no forced success after three questions. AI/network errors preserve the input for retry. Input and conversation sizes are bounded; the endpoint is limited to 20 requests/minute/account.

The gate runs on `openai/gpt-5.6-luna` at `reasoningEffort: "xhigh"` (`ONBOARDING_MODEL` overrides the model; the effort is fixed). Both are set once in `src/services/aiModelIds.ts` (`onboardingModel`, `onboardingProviderOptions`) and used by both interview entry points. Reasoning effort goes through the AI SDK's `providerOptions.openai.reasoningEffort`, not a top-level call setting; AI SDK v6 has no top-level reasoning field, and the AI Gateway forwards provider options keyed by the real provider name (`openai`, not `gateway`). The provider default is `medium`, so nothing is left unspecified: the gate is intentionally at the model's highest effort.

The model's `checks` array is authoritative: `accepted=true` is only honoured when every check passed. A failed check demotes the result to a rejection **and** rewrites the summary and question from the failed check's own detail, because a reply written as an acceptance carries an "understood" summary and a next-stage question that read as nonsense beside a `needs one more detail` status and an **Improve my answer** action. That mismatch in production turn #8 of user `670fb420158ba86def604e67` (goal stage, revision 1510) is what motivated it.

The screen uses the Home `Reveal` implementation, a five-segment progress indicator, compact top navigation, generous horizontal spacing, a large line icon, readable multiline input and a bottom action area that moves above the keyboard. Reduce Motion is inherited from Reveal.

Each semantic-gate response now opens a dedicated coach validation screen instead of placing coach copy in an orange card beside the next question. The coach avatar and status appear first, the response fades in word by word without reflow, and only after the full response renders does Continue appear with a twelve-second growing auto-continue indicator. Accepted answers advance from Continue (or can be edited); rejected answers return to the same gate and show a neutral **Make this answer more concrete** card. Reduce Motion reveals the response immediately before starting the same continuation window.

Native answer fields include dictation through `expo-audio`. The microphone records locally until Stop, then uploads one M4A file to the existing authenticated `/ai/transcribe` backend route. The returned text is appended to any typed answer with one separating space; it never replaces existing text. Production STT is server-side OpenRouter `nvidia/parakeet-tdt-0.6b-v3`, so the provider key is not bundled in the app. Language is auto-detected. Empty transcripts, permission denial and network/provider errors remain on the current answer and show a retryable explanation.

The interview endpoint also reads the signed-in user's active activity catalog and non-deleted log history server-side. When the activity is already known, the coach uses that context, avoids asking how often the person currently performs it, and asks only for the desired weekly plan target. It never claims it cannot inspect an activity that appears in this trusted app context.

## Preview and real onboarding

Both modes render **the same `Onboarding` component and call the same AI endpoint**, with the same initial interview and gate behavior. Preview changes the small header indicator and intercepts account writes, plan creation and payment launch. It simulates the new/free-member offer regardless of the current account's subscription. It never mutates onboarding progress through the older PWA endpoints. Its completion message explains the difference.

New-account auto-onboarding (`OnboardingGate`), the manual create-plan route and Settings preview all resolve to this same component. Real onboarding persists each completed gate and pending extraction confirmation. Reopening restores the interview, including the review/checkout checkpoint. Older native drafts retain their goal/schedule/activity and enter the new interview for confirmation. Plan creation retains the existing UUID-based idempotency and stores motivation, baseline and dialogue for subsequent coaching.

The shared code and fixture checks establish UI/flow parity. They do not make stochastic AI wording identical across runs, test account signup, or prove a real purchase. Production Apple in-app purchase/restore remains separate unfinished work.

## Upgrade handoff

The app rechecks the backend account before opening checkout, persists the pending upgrade, and polls verified entitlements for two minutes and on foreground/reopen. A successful confirmation immediately creates/opens the one draft plan. Closing checkout does not unlock access. A delayed confirmation can be checked again; choosing free tracking cancels automatic coaching completion. Failed completion can retry with the same plan UUID. Returning to the app always refreshes the account query; a changed plan invalidates dependent cached screens.

The current payment provider is still the existing web checkout. Apple StoreKit products, verified transactions, restore and subscription management are **not implemented by this change**. Pricing/trial confirmation was requested; no Apple product or paid subscription was created. Do not describe this as an App Store-ready payment implementation.

## Settings drawers

Color Themes now has the original ordered palette previews, three swatches, selected outline and the Random option (persisted per account, changing after three days). Theme Mode has descriptive Light/Dark/Auto cards. Smaller Back controls and headings match the PWA. Integrations has separate Apple Health/API key cards, with child Back navigation returning to Integrations inside the same drawer. API keys restores the three-step connection setup and copyable prompt/command. User Settings uses summary cards, read-only username/email, individual name/age/accountability/profile edits and explicit deletion confirmation. The activity editor parity work is retained.

## Verification

- OpenRouter's current STT contract was checked against its model page and multipart transcription documentation. The Parakeet model page lists `$0.0015/minute`; a synthetic M4A phrase passed through the deployed production STT service and transcribed accurately with the new model.
- The focused backend STT configuration tests cover OpenRouter selection, the default Turbo model and the OpenAI fallback. Backend and frontend TypeScript pass. All eight onboarding browser cases pass with the dedicated accepted/rejected intermediary flow and actual timed automatic continuation.

- Frontend and backend TypeScript checks passed.
- Eight main browser cases passed: dark/light shared preview gates, rejection/contradiction/network retry, resume after extraction, delayed upgrade/reopen with exactly one completion, free tracking/retry, and dark/light settings subdrawers. Log: `/private/tmp/tracking-upgrade-settings-browser-final.log`.
- Nine backend gate contract tests passed, covering AI failure, malformed output, failed semantic checks, repeated rejection and incomplete/invalid suggested plans. Combined Health/interview unit run: 39 passed. Log: `/private/tmp/tracking-release-backend-unit.log`.
- Five Health persistence tests passed against the isolated local PostgreSQL test database, never production. Log: `/private/tmp/tracking-release-health-persistence.log`.
- Six live synthetic checks against the actual configured model passed: keyboard noise, prompt injection, abstract goal, sincere informal goal, conflicting budget, realistic rhythm. They ran in the prepared backend image using the existing production gateway credential and no database writes. Private report: deployment overlay `evidence/tracking-onboarding-live-smoke.json`. This is a bounded smoke check, not the separately pending model-comparison benchmark.
- A ninth browser regression verifies that a rejected refinement cannot restore an earlier accepted extraction on reload. Log: `/private/tmp/tracking-interview-refinement-test.log`.
- The rebuilt ExpoAudio simulator app passed full native onboarding in DARK and LIGHT. The final dedicated dictation run, `test-results-native-ios/2026-09-16_092035/onboarding-keyboard-ios/`, verified microphone permission, a non-empty M4A upload, stop/transcribe state and that returned text appends after existing typed text. The coach validation layout was inspected in `test-results-native-ios/2026-09-15_203857/onboarding-ios/takeScreenshot/onboarding-extraction.png`.
- Full native DARK and LIGHT flows passed: `test-results-native-ios/2026-09-15_172447/onboarding-ios/` and `2026-09-15_172800/onboarding-ios/`. A screenshot review then caught keyboard safe-area drift and a partially covered answer/action. The final frame keeps the header inset stable and scrolls the input above the keyboard. Targeted keyboard flows passed after correction: DARK `2026-09-15_173318/onboarding-keyboard-ios/`, LIGHT `2026-09-15_173217/onboarding-keyboard-ios/`. Both screenshots and keyboard dismissal were inspected. Use `--onboarding-keyboard` with the same native runner environment to reproduce. Exact final IPA status is in frontend BUILDING.md.
- Build 27 lacks the settings/interview follow-ups; build 28 lacks the final keyboard and rejected-refinement corrections. Both were locally verified but **never published**. Use only the final later artifact for these changes.

From `apps/frontend-expo`:

```sh
pnpm exec tsc --noEmit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer node node_modules/@playwright/test/cli.js test e2e/onboarding-flow.spec.ts e2e/settings-drawers.spec.ts
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home E2E_IOS_DEVICE=47C54325-6609-4987-AA27-ACBFA499A1D5 MAESTRO_BIN=/private/tmp/tracking-expo-maestro/maestro/bin/maestro E2E_IOS_APP=/private/tmp/tracking-watch-phone-simulator/Build/Products/Debug-iphonesimulator/trackingso.app E2E_THEME=DARK node e2e/native/run.cjs --ios --onboarding
```

Repeat the native command with `E2E_THEME=LIGHT`. Do not edit app source during these runs: Fast Refresh can restart the in-memory preview. When the fixture implementation changes, restart its existing local server before testing. Native buttons expose their explicit accessibility label, which can group the description; inspect the screenshot as well as the accessibility hierarchy.

## Delivered release

Local production build 35 is verified and hosted with these changes, including native dictation and the dedicated coach validation transition. The complete downloaded IPA matches its verified SHA-256 and contains ExpoAudio plus all UI markers. Installation metadata and exact reproduction commands are in [the frontend build guide](../apps/frontend-expo/BUILDING.md). No Expo cloud build quota, OTA publication or App Store submission was used.
