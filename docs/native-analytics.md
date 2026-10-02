# Native analytics (PostHog)

The Expo app sends product analytics to the **same PostHog project as the web app**: the EU host, with the key read from `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`, or overridden by `EXPO_PUBLIC_POSTHOG_*`. After sign-in it calls `identify(User.id)`, the database user id the web app's `GeneralInitializer` uses, so one person's web and iPhone events land on one PostHog person. Sign-out calls `reset()`.

Code: `apps/frontend-expo/src/analytics/`, holding `types.ts` (the event contract), `client.ts`, `AnalyticsSession.tsx` (identify and streak milestones) and `streak-milestones.ts`. Only release builds send events. Development and E2E builds log `[analytics] …` to the console, and the Expo web target sends nothing.

## Events

Event names use the web app's kebab-case convention. `onboarding-completed` is the web's exact event name.

| Event | Fired when | Properties |
| --- | --- | --- |
| `onboarding-started` | First-run onboarding opens (not the preview or create-plan reuse) | none |
| `onboarding-completed` | First-run onboarding finishes | `coaching` |
| `plan-created` | A plan is created from onboarding, the create-plan interview or the advanced editor | `source`, `coaching` |
| `first-habit-created` | Same as above, when the account had no plans | `source` |
| `activity-logged` | Manual log or voice-log commit succeeds (duplicates excluded) | `source`, `count`, `has_photos`, `with_friend` |
| `streak-milestone-reached` | A plan's weekly streak crosses 1, 2, 4, 9, 12, 26 or 52 weeks. The first sighting of a plan only records its baseline | `weeks`, `plan_id` |
| `coach-opened` | The coach conversation is shown | `plan_id` |
| `coach-message-sent` | A message to the coach succeeds | `has_images`, `from_starter` |
| `friend-request-sent` / `friend-added` | A request is sent / accepted | none |
| `circle-joined` | A circle is joined or created | `method` |
| `coach-paywall-viewed` | The onboarding coaching offer is shown | `placement`, `has_trial` |
| `purchase-started` / `purchase-completed` | Checkout opens / the server entitlement turns paid | `placement`, `store`, `plan_type` |
| `health-connected` | Apple Health or Garmin is connected | `provider` |
| `watch-used` | **Sent by the backend** (`apps/backend-node/src/services/analytics/`) at most once a day when a Watch token authenticates. The Watch calls the API directly, so the phone never sees it | none |

PostHog's own `Application Opened` / `Installed` lifecycle events are on, for retention. There is no session replay and no touch autocapture.

## Privacy boundaries

- No email, name or other profile field is sent from native. Only the user id.
- No Apple Health measurement may be added to any event. The [privacy policy](https://tracking.so/privacy) promises Health data is excluded from analytics. `health-connected` carries only the provider name.
- The privacy policy already lists PostHog. The App Store privacy label (published September 30, 2026) declares **User ID** and **Product Interaction** for Analytics and App Functionality, linked to the user, not used for tracking. The same update added Precise Location, Audio Data (voice logs/dictation) and Other User Content (messages, comments), all for App Functionality, linked, not tracking.
- IP-based GeoIP is disabled (`disableGeoip`), so no Coarse Location is derived. The SDK also adds device model, OS, app version, locale and timezone. It sends no advertising identifier or identifier for vendor.
- Open decision: the building principles say "no personal data to a third party … without consent". Native currently matches the web (on by default, no opt-out). The planned privacy and AI-sharing consent step (store review finding #3) should also cover analytics consent, calling PostHog `optOut()` / `optIn()`.
