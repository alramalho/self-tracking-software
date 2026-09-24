# Garmin: moving to a production key

Source: Garmin Connect Developer Program docs (Start Guide 1.2.1, Health API 1.2.4, Activity API 1.2.5, OAuth2 PKCE, OAuth1→2 migration), developerportal.garmin.com → Program Docs.

## What Garmin requires

- **Webhook-only.** "Ad-hoc requests for data are not permitted." Data arrives by ping (callback URL) or push (payload) after the user's device syncs. Production review rejects pull-only integrations.
- **Reply 200 within 30 s**, then process asynchronously. Accept payloads up to 10 MB (Activity Details up to 100 MB).
- **Deregistration and User Permission endpoints enabled.** Call `DELETE /partner-gateway/rest/user/registration` whenever our app disconnects someone.
- **At least two authorized Garmin users**, verified with the Partner Verification tool.
- **UX/brand review:** screenshots or video of every Garmin mark, attribution and the full connect flow.
- **Account:** every developer who touches the API added as a verified member (no gmail/generic addresses); subscribe to the API blog.
- **OAuth 1.0 is retired 2026-12-31.** New apps use OAuth2 PKCE.

## Our checklist

1. Deploy `coach-garmin-20260924` (see hetzner/MIGRATION.md).
2. At `apis.garmin.com/tools/endpoints` (log in with the evaluation key/secret): enable every Health and Activity summary type plus deregistrations and user permissions, all pointing to `https://api.tracking.so/health/garmin/webhook`.
3. Reconnect Garmin in the app so a fresh 30-day backfill is requested; confirm workouts arrive (`Garmin Connect sync completed` / webhook logs, `health_workouts` provider `garmin_connect`).
4. Get a second Garmin user connected; run Partner Verification.
5. Create a new app in the Developer Portal with product **Production**; submit the verification result and UX screenshots.
6. After approval, set the production client ID/secret in the server `.env` with `GARMIN_OAUTH_VERSION=2`, configure the same endpoints for the production key, and ask users to reconnect.

## Not supported any more

- Scheduled pulls and the "Sync now" button (the `/health/garmin/sync` route only refreshes permissions, for old app builds).
- Asking users to email Garmin support for missing data. If our endpoint was down, Garmin's **Summary Resender** tool (API tools) replays notifications for us.
