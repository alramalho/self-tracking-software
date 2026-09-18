# Wrapped 2025 and native people search — September 14, 2026

## Scope and scoring

The user corrected build 16's lifetime ranking: Wrapped must show only 2025 values. Build 15 counted a profile preview capped at 40 entries; build 16 replaced that with lifetime totals. Neither is the correct annual ranking.

`GET /users/wrapped?year=2025` now returns annual aggregates for the authenticated viewer and accepted connections only. It does not accept arbitrary target-user IDs or return private activity details. The year uses explicit UTC bounds: January 1 inclusive through the next January 1 exclusive, independent of the client/server's local timezone. Deleted entries and deleted activities are excluded, consistent with account points. Archived/finished plans remain eligible for dated awards.

Points are eligible activity entries in the year + 25 per habit award with an `achievedAt` in the year + 100 per lifestyle award with an `achievedAt` in the year. A badge lost later still counts when its recorded award date is in 2025. Current `isAchieved` flags never substitute for historical dates. Undated awards are not guessed or copied from lifetime totals. Historical streak peaks use cached dated plan weeks for the selected year and the backend's one-week buffer; cross-boundary completion cannot borrow activity from the following year. This does not reconstruct old plan targets or missing award dates.

Native Wrapped requests this endpoint for self and friends, versions its cache by year and account, validates the response year, and shows an error/retry if annual totals are unavailable. It never falls back to a 40-entry preview or lifetime points. The leaderboard, streak ranking, hero streak totals and plan peaks/award labels use annual values. Existing slide/podium/row animations remain.

Production read-only verification for `@liocas`: **345 eligible activities in 2025**, versus 562 lifetime activities. One dated habit award and one dated lifestyle award give **470 points**. Running the new service against the production database in an explicit READ ONLY transaction returned the same values, with a 15-week annual peak. This is observed production data, separate from fixtures. No activity or plan was modified by verification.

## Search and navigation

The previous native screen sent arbitrary entered text directly to `/profile/<text>`. It now displays debounced search results and navigates only after selecting an actual username. It matches display names and usernames, normalizes case, accents and an initial @, and ranks exact/prefix/substring matches ahead of bounded spelling mistakes and abbreviations. `Lia`, `@liocas` and `liocsa` find Lia Borges / @liocas. Search retains the existing backend's accepted-connection scope; recommended people remain available when the query is empty. This is not a global directory of all accounts.

The search header and input remain available during loading, empty results and errors. Requests are cancellable, outdated results are hidden while typing, and returning from a profile preserves the query. External profiles now have a fixed Back control even when loading or not found.

## Validation

From repository root:

```sh
pnpm --filter backend-node exec tsc --noEmit
pnpm --filter backend-node exec vitest run src/services/wrapped/model.test.ts src/services/wrapped/service.test.ts src/services/people/rank.test.ts
pnpm --filter frontend-expo exec tsc --noEmit
```

From `apps/frontend-expo`:

```sh
node --import tsx --test tests/wrapped.test.ts
node node_modules/@playwright/test/cli.js test e2e/wrapped.spec.ts e2e/people-search.spec.ts
```

Seven backend unit tests, four native model tests and eight browser E2E cases passed. Browser evidence: `/private/tmp/tracking-year-search-browser.log`, captures under `test-results/`. Native iOS uses the simulator environment in `BUILDING.md` with `node e2e/native/run.cjs --ios --year-search`, once per DARK/LIGHT theme. It covers name/typo search, keyboard, profile/back, empty results, all Wrapped stories, 470 annual fixture points, Home retap and the share sheet. Both native runs passed; exact evidence paths and verified build-17 installation metadata are recorded in the frontend BUILDING.md.

## Backend deployment

The running backend's `src/routes/users.ts` hash matched the local pre-change file (`c42a8d1542029f0189152ceac48ab187cc20f9e5486ade63caa189a5dcb5635a`). An image layer was built from the existing production image, copying only the changed users route and the new `services/wrapped` / `services/people` modules. No database migration, registry push, frontend deployment or other service update was performed.

- SSH key on this Mac: `~/.ssh/hetzner_ed25519` (the older AGENTS example `~/.ssh/hetzner` does not exist).
- Host: `root@89.167.84.67`.
- Compose directory: `/root/workspace/tracking.so/deployment`.
- Compose files: `docker-compose.yml` and `docker-compose.localdb.yml`.
- Previous image: `local/tracking-so-backend:0838c450`, ID `sha256:b8fc3788e0485664280c908a5439e996d46f77f01edc6cfb82f44f5d5cab2380`.
- New image: `local/tracking-so-backend:wrapped-2025-search-20260914`, ID `sha256:ac7a72517c15df813b6ae099b82d7978a8a4427d075801a6e9648b9557613da8`.
- Local source context and read-only verification script: `/private/tmp/tracking-year-search-release/`. Remote context, logs, read-only evidence and previous image setting: `/tmp/tracking-year-search-release/`.
- The deployed image was validated against production using a one-off Compose container, `pnpm exec tsx .verify-wrapped.ts`, with the verification script mounted read-only. Only after that passed was the backend service recreated.
- `/health` returned 200. Unauthenticated `/users/wrapped?year=2025` and `/users/search-users/Lia` returned 401. The backend image selection was persisted in the existing deployment `.env` by changing only `BACKEND_IMAGE`; unrelated configuration was preserved.

Switch the backend image from the Compose directory:

```sh
BACKEND_IMAGE=local/tracking-so-backend:wrapped-2025-search-20260914 docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d --no-deps backend < /dev/null
```

To roll back, substitute `local/tracking-so-backend:0838c450`, and restore the previous BACKEND_IMAGE setting recorded in `/tmp/tracking-year-search-release/previous-image-setting.txt`. Do not print or replace unrelated environment values. Keep the same Docker network, database configuration and remaining services.

The source changes remain in this workspace; no commit/push was made. Include these backend modules and the route change in the next normal source deployment so a subsequent CI release retains the fix.
