# Circles

Small groups of people working on a similar goal, who see each other's week. Circles replace plan groups, practice circles v0 and accountability-partner recommendations.

## Product rules

- **Size:** matching fills a circle up to 5 people, invites up to 8. The weekly board starts at 3; below that a circle is *forming*.
- **One circle per plan.** You join with one of your plans; that plan's week and logs (activity, amount, date, photo, caption) are shared with the circle, even if the plan is private to everyone else. Location and private notes never are.
- **Misses are visible, kindly.** The board shows everyone's week. Someone is *behind* when finishing needs every remaining day; they show "N to go" in orange and get a motivate button. People who joined mid-week are *New* and never behind.
- **No approval step.** Matches and invites join straight away. Owners can rename, invite, turn matching off and remove a member. Report and block work on members and on the circle.
- **Circles are free.**
- **Matching starts wide** (few users per goal yet): goal similarity always, pace on by default, time zone instead of distance unless someone asks for "Nearby", age only if asked. A pair scores as its weaker side. If nothing is close enough, the person starts a forming circle and matching fills it; an hourly job merges compatible forming circles.
- **Intro:** a member's first log on the circle plan after joining is their intro. Helly asks for it on the circle screen and the log editor shows "Shares to …".
- **Encouragement:** the hand button and member menu open “Motivate [name]” with their avatar and a blank personal message. Opening or dismissing sends nothing. Only Send encouragement creates a private chat message; normal message notifications apply. Both people must have posted their first photo in the circle and must not have blocked each other. Earlier nudge limits do not hide this composer. The legacy nudge endpoint remains for older clients.
- **Helly in the circle chat.** Sunday 19:00 (owner's time zone): scores, the photo of the week (most reactions, attached to the message), who leads the last weeks, and one "never miss twice" ask for whoever missed. Thursday 18:00: who's behind, only if someone is. The owner can switch Helly's posts off (⋯ menu); each member can mute the circle's pushes.
- **Together before against.** The circle page keeps "This week" as the place to act. "Past weeks" opens the last 6 finished weeks: the circle's sessions against its combined target (🔥 when everyone hit theirs), then everyone ranked by the share of their *own* target, capped at 100%, ties sharing a rank. Nobody is labelled last; new members rank after their first full week.
- **Week chip on circle logs:** "3 of 4 this week", or "Week done ✅" on the log that completes the week, on the home timeline and the circle feed.
- **Invite previews:** `/og/circle-invite/:code.png` draws a light 1200×630 card per circle (satori + sharp); the web app's `middleware.ts` puts it in the meta tags for link crawlers.

## Code map

- Backend: `apps/backend-node/src/services/circles/` (matching levers, board, coach posts, nudges, jobs, previews, timeline) and `routes/circles.ts`; invite previews in `services/og/` and `routes/og.ts`. Tests: `services/circles/**/*.test.ts`, `routes/circles.integration.test.ts`.
- Schema: `Circle`, `CircleMember`, `CircleNudge`, `User.approx*`, `ActivityEntry.imagePreview`, `NotificationType.CIRCLE`. Migration `20260929090000_circles` (additive, includes the backfill).
- Expo: `src/features/circles/`, screens `app/circle/[id].tsx`, `app/circle-match.tsx`, `app/circle-invite/[code].tsx`; onboarding circle steps in `features/onboarding/CircleSteps.tsx`.
- Web: `apps/frontend-vite` circle routes mirror the Expo screens.

## Deploy

1. **Backup** the production database before the migration.
2. **Check the backfill** on a copy first:
   ```sql
   SELECT count(*) FROM practice_circles;
   SELECT count(*) FROM plan_groups g WHERE (SELECT count(*) FROM plan_group_members m WHERE m."planGroupId" = g.id AND m.status = 'ACTIVE') >= 2;
   ```
   After the migration, `circles` should hold roughly both counts (plans that are deleted, archived or in two groups are skipped).
3. Apply migration `20260929090000_circles` (additive: new tables, three nullable `users` columns, one nullable `activity_entries` column, one enum value).
4. Deploy the backend image; check `/health` and that `GET /circles/mine` without auth returns 401.
5. Ship the app build.

**Rollback:** redeploy the previous backend image. The migration only adds, so the old code keeps working with the new columns and tables in place. Older app builds lose the v0 circles screen (its API is replaced); that screen was only reachable from the calendar menu.

**Later cleanup (separate, destructive, with its own backup):** drop `practice_circle_*`, `plan_groups`, `plan_group_members`, `plan_invite_links`, `Plan.planGroupId`, `Chat.planGroupId`, `User.lookingForAp`, `Recommendation`, once web no longer uses plan groups.
