# Plan coaching: implemented first slice

The native app reuses the onboarding review, plan page, shared coach conversation and proposal cards. No database migration is required: coaching agreements and monitoring state live in the existing `CoachingState` JSON record.

- **Onboarding:** infer tracking, consistency or training from the existing interview. Show an editable “Coaching and data” summary before creation. Training queues an initial design in Messages; missing baseline information becomes a question. Explicit subscription/trial entitlement is required.
- **Plan:** one Coaching row edits role, review day/time, follow-ups and independent workout/sleep permissions. A pending question or proposal opens its exact message. A queued first design is visible while preparing.
- **Messages:** one shared conversation, filters for plans, editable per-plan data access. Plan changes require opening the review and accepting. Accepted cards open the updated plan. A proposal prepared against an older plan is rejected instead of overwriting a later edit.

## When contact happens

The worker wakes hourly at minute 7. Reviews use the saved local weekday/time with a four-hour recovery window. Initial training design starts after creation/configuration and is retried by the worker if generation fails.

The worker combines reviews due together, allows at most one unsolicited contact per day, and waits after recent conversation. Extra contact after explicit difficult activity feedback is limited to once a week and the chosen review hour. Scheduled session checks require both the existing check-in setting and follow-up permission; flexible plans have no invented missed weekdays.

An unanswered question can get one notification reminder after three days, at the chosen hour. It opens the original message. Reading a message never counts as replying. A reply in the plan's thread, or in the unfiltered "All" thread, resolves the open request.

What silence means depends on the plan's role (`resolveRequests` in `coach/monitoring/model.ts`):

- **Training:** an after-session check (on by default for training plans) with no reply and no log for a day marks that session `SKIPPED` with `assumedMissed`. The next review adapts instead of stacking load. A late log still turns it into `DONE`.
- **Consistency, with follow-ups on:** seven days after the reminder, the plan goes on `lapsePlanIds`. At the next review hour the coach sends one short message that uses the person's own `goalReason` and attaches an archive proposal. Logging the habit again cancels or resolves it. If that message is ignored for seven days, contact pauses.
- **Everything else:** seven days after the reminder (or after the question, with reminders off), contact pauses for those plans. Nothing is archived without the person accepting a proposal. Resuming contact is explicit.

Concurrent workers claim a lease. Before saving a generated response, the service rereads plans, logs, agreements, conversation and account access. Changed information discards the response. Message/notification records are durable before a push is attempted. Push failure does not generate a duplicate message. A visible conversation suppresses its push.

## Data access

Watch integration alone grants no AI access. The user separately enables workouts and/or sleep for each coached plan. The prompt receives bounded summaries: distance, duration, average heart rate and effort where present, or sleep duration/score, plus sync freshness. Raw heart-rate samples, routes and arbitrary provider metadata are excluded. Imported records remain excluded from ordinary AI activity queries.

Health-bearing responses carry their permission scope. Subsequent generation excludes that history when the scope or category no longer has permission. Such conversations bypass unscoped Supermemory ingestion and AI title generation. Existing visible messages are retained. Release disclosures still need to reflect this opt-in path; this change was not deployed.

## Five reusable behavior stories

`apps/backend-node/src/services/coach/monitoring/service.integration.test.ts` uses an isolated PostgreSQL database and the real top-level monitoring operation. Only model generation and push delivery are replaced. The reusable plans are a beginner’s sub-two-hour half marathon, meditation for calmer reactions, and exercising four times weekly with friends.

| Story | App action and observable result |
| --- | --- |
| Tracking, then two coached plans | Tracking produces nothing. Running and meditation become due together; concurrent worker invocations produce one conversation update and one notification. |
| An explicitly difficult run | The user saves a hard rating and a specific note. The coach proposes a lighter week; the saved target remains unchanged until acceptance. Editing the plan makes the older proposal stale. |
| Read, no reply | The user reads a question without answering. One reminder follows, then outreach pauses. The plan remains active and no missed activity is manufactured. |
| Plans change during generation | The user pauses a plan or adds a log while the review is being prepared. The stale result is discarded. A newly requested training design can ask a question; replying about another plan does not answer it. |
| Missing scheduled run, late log, watch permission | A session remains unconfirmed while missing. A later real log resolves it. Watch context appears only for the granting plan and selected category, and disappears after revocation. |

Additional checks cover continuation questions, revoked health-history access, quiet model decisions, model failure/retry, failed pushes, visible conversations, daylight saving time, subscription expiry, opting out of reminders, and pausing outreach mid-generation.

## Verification, 23 September 2026

- 44 backend tests passed: 15 monitoring persistence cases, 14 existing follow-through cases, 15 onboarding interview cases.
- 15 native data/routing/onboarding tests passed; backend and native TypeScript checks passed.
- Actual Expo web screens checked at 390 × 844 in light/dark: save versus cancel, plan filter, exact message link, proposal review, acceptance, updated-plan link and onboarding coaching settings. This is not an iOS device test.
- Live coaching quality is **not validated**. Both the local and user-supplied shared Vercel Gateway credential returned HTTP 401. No model-quality result passed.

Run persistence tests only with the guarded local test database (never production):

```sh
cd apps/backend-node
DATABASE_URL=postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test DIRECT_URL=postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_IDS= node node_modules/vitest/vitest.mjs run src/services/coach/monitoring/service.integration.test.ts src/services/follow-through/model.test.ts src/services/follow-through/onboarding/interview/service.test.ts
```

With an authorized working Gateway key, `node --import tsx scripts/coach-monitoring/live.cjs` runs three synthetic scenarios through the real coach and evaluates groundedness/usefulness using `typesafe-ai/jev`. It disables telemetry/Telegram for the experiment, cleans up its synthetic users and saves output to `/tmp/tracking-coach-live-results.json`. `COACH_GATEWAY_KEY_FILE` can point to an explicitly supplied local Markdown file containing the shared key; the key is read in memory, never copied into the repository. Review the actual replies and proposals before treating evaluator scores as evidence of good coaching. Expand those examples from observed use rather than adding prompt-specific assertions.

Calorie logging, full training-program quality evaluation, device notification delivery, and production rollout are outside this verified slice.

## Update, 24 September 2026

- Onboarding's rhythm step runs a `typesafe-ai/jev` realism check when there is a target date (`goalLooksRealistic` in `onboarding/interview/guidance.ts`). It pushes back once, then accepts the person's choice.
- A first-week design can include `alsoTrack` (for example Weight, kg). This becomes a `track` entry in the plan proposal patch. Accepting it connects an activity (reusing one with the same name), so the person logs it normally and later reviews see it.
- `scripts/coach-monitoring/compare-models.cjs` runs held-out synthetic cases through the real prompts for several Gateway models (no database). Results and a written read are in the review page, section 05.
- The scheduled coach uses its own model setting: `SCHEDULED_COACH_MODEL`, default `deepseek/deepseek-v4.1-flash` at `low` reasoning (override with `COACH_AGENT_REASONING`). The interactive chat and the older assessment coach keep their Luna defaults.
