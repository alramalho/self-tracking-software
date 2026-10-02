# Coach scheduler: reusable givens and five acceptance cases

Status: original design examples, not a record of executed tests. The implemented first slice and its automated cases are documented in [plan-coaching-monitoring.md](plan-coaching-monitoring.md). Some timing and plan examples below differ from that first slice; the live-model experiments have not passed because Gateway authentication returned HTTP 401.

## Reusable givens

Cases inherit the common account settings, select plans from the three definitions below, then add their own history and events. These are three reusable plan definitions, not three plans required in every test.

### Plans

When a case includes a plan, the user has already created and accepted it:

| Plan | This week | What the coach has been told |
| --- | --- | --- |
| Running | Tuesday 5 km, Thursday 5 km, Saturday 8 km | A saved guide prescribes 9 km next Saturday if this week is completed; otherwise repeat the current week. This is test data, not a general training rule. |
| Studying | Three 30-minute sessions, any days | Help maintain the habit. No scores or information about understanding. |
| Meditation | Ten minutes on five days, any days | Maintain this habit; do not keep increasing the target. |

### Connected workouts, when a case uses them

Garmin is connected. The user has granted the proposed permission for the AI coach to use workout data, but not sleep data. This is separate from social sharing and must not bypass today's health-data exclusion before permission support exists.

### Common account settings

The user has enabled coaching follow-ups and a Sunday 18:00 review in their local timezone. Session reminders are off. Daily checks run at 18:00; a check need not create a message. The weekly review includes activities recorded through Sunday 18:00.

### How the cases compose

| Case | Reuse these plans | Additional given |
| --- | --- | --- |
| 1. Quiet successful week | Meditation | None |
| 2. Difficult run | Running + Studying | Connected workouts |
| 3. Uneven week | Running + Studying + Meditation | Connected workouts |
| 4. Silence and return | Running + Studying | Connected workouts, stale sync |
| 5. Travel at review time | Running + Studying + Meditation | Connected workouts, pending proposal |

Each test gets a fresh account assembled from those givens. Keep conversation and changes between steps within a case, but never depend on another test having run first. Logs, replies and later edits are actions in the case, not a second invented starting setup.

In code this can be nested suites with a common account setup, reusable plan builders and case-specific starting history. Keep these same readable “Given / action / expect” sequences alongside the automated assertions.

## 1. A quiet successful week

**Given:** common account + Meditation.

1. **User:** records ten minutes on Monday, Tuesday, Thursday, Friday and Saturday. Daily checks run after these actions.
   **Expect:** progress updates without a coach message after every log. Wednesday is not treated as a missed session.
2. **Scheduler, Sunday 18:00:** runs the review while the app is closed.
   **Expect:** one review recognizes five meditation days. The target stays unchanged; no invented harder goal or unnecessary question.
3. **User:** taps the notification and reads the exact review in Messages without replying.
   **Expect:** no chase for an answer to an informational message. The plan remains unchanged.
4. **Scheduler, 18:02:** runs again.
   **Expect:** no duplicate review or push.

**Good coaching:** recognize success and let the user carry on.

## 2. One run is difficult; studying is going well

**Given:** common account + Running + Studying + connected workouts.

1. **User:** completes the two 5 km runs and three study sessions. Saturday's imported run is only 5 km. In workout review, they link it to the planned 8 km run.
   **Expect:** the coach does not mistake a linked workout for completion of its full distance.
2. **User:** edits that activity, selects “Very hard” and saves “Stopped at 5 km; couldn't finish the last part.” Saving starts a coach check.
   **Expect:** a message connects the 5 km result and explicit feedback to the saved guide, offering to repeat the week. A relevant clarification is acceptable; asking whether the run happened or inventing a diagnosis is not.
3. **User:** opens Messages and replies, “Yes, repeat this week.” They review and accept the proposal.
   **Expect:** next week's running prescription is 5/5/8 km instead of 5/5/9 km. Until acceptance it stays unchanged. Studying is untouched.
4. **Scheduler, Sunday 18:00:** runs the weekly review.
   **Expect:** acknowledge the accepted adjustment and studying progress. Do not offer the same change again.

**Good coaching:** use what the user actually reported, follow their saved guide, and remember the decision.

## 3. Running is complete; studying and meditation have few logs

**Given:** common account + Running + Studying + Meditation + connected workouts.

1. **User:** records all three runs, one 30-minute study session and no meditation. Daily checks run.
   **Expect:** no invented missed weekdays for the flexible plans.
2. **Scheduler, Sunday 18:00:** runs the review.
   **Expect:** one message accurately distinguishes running completed, one study session recorded and no meditation recorded. Ask one focused question about whether the week or targets still fit. Do not infer poor understanding or claim meditation did not happen.
3. **User:** replies, “Work was busy. I only studied once. Make studying two 20-minute sessions next week only; leave running and meditation alone.”
   **Expect:** a proposal for that temporary study change. No extra meditation interrogation or changes to the other plans.
4. **User:** accepts the proposal.
   **Expect:** Plans shows two 20-minute study sessions for next week, then the original three 30-minute sessions afterward. No catch-up debt. A verbal promise without the saved change fails.

**Good coaching:** distinguish recorded facts from assumptions and implement the user's specific adjustment.

## 4. No logs, no replies, then the user returns

**Given:** common account + Running + Studying + connected workouts. Last successful sync: Wednesday.

1. **Scheduler, Sunday 18:00:** sees no logs for either plan and the stale Garmin sync.
   **Expect:** one combined check explains the running data gap and asks how the week went. It does not claim the user abandoned both plans. Its push is successfully delivered; the user does not reply.
2. **Provider, Monday:** sync succeeds with no new runs. **Scheduler:** runs daily through Saturday.
   **Expect:** no daily chasing. A successful empty sync still cannot prove the user never ran without their watch.
3. **Scheduler, next Sunday 18:00:** sends one further brief question, successfully delivered and again unanswered. After both questions have been unanswered for at least 24 hours, unsolicited checks pause.
4. **Scheduler, third Sunday:** sends no further coach push. Both plans remain unchanged.
5. **User, Tuesday:** opens Messages and writes, “I stopped running. Help me restart with two runs this week; leave my other plans alone.”
   **Expect:** respond to that request, ask for any necessary missing information and offer a reviewable running adjustment. Do not demand answers to old questions, modify studying or silently re-enable unsolicited contact.

**Good coaching:** back off without abandoning the ability to help when the user returns.

## 5. Travel and late data arrive as the review is due

**Given:** common account + Running + Studying + Meditation + connected workouts.

**Additional history:** earlier in the week, the user asked about moving next Thursday's run to Friday; the resulting proposal is still pending.

1. **Provider, Sunday 17:55:** delivers the week's three completed runs late, then delivers the same batch again. Three study sessions and one meditation day were logged manually.
   **Expect:** three physical runs, using their actual activity dates. No duplicate progress or burst of coach messages.
2. **User, 17:57:** pauses studying in Plans.
3. **User, 17:59:** opens Messages and writes, “Travelling next week. Only Tuesday and Saturday available. Two runs maximum; leave meditation alone.”
4. **Scheduler, 18:00:** the weekly review becomes due while the response is being prepared.
   **Expect:** one coherent conversation using the imported runs, paused studying and latest availability. Offer a two-run week or ask a necessary question about adapting the saved guide. Do not squeeze three runs into two days, suggest Friday, chase paused studying or send a redundant push while this conversation is open.
5. **User:** reviews and accepts the resulting proposal.
   **Expect:** only the agreed Tuesday/Saturday running sessions; studying remains paused; meditation stays unchanged. The old Friday proposal is visibly superseded and cannot still be accepted. Its old notification opens that resolved state.
6. **Scheduler/provider:** repeat the due check and import batch.
   **Expect:** no extra workouts, proposals, notifications or changes to the accepted week.

**Good coaching:** act on the latest facts and request without creating conflicting decisions.

## How to test these

Use Vitest with a controlled clock and isolated test account. Perform the app actions through their normal entry points, feed synthetic imports through the import path and invoke the real scheduler. Use real coach responses; capture pushes instead of delivering them. Native UI tests verify notification destinations and proposal acceptance.

For every step, retain the actual messages, notifications and visible plan before/after. Assert those outcomes, not private helper calls or exact sentences. Review whether the coach used the available facts, respected prior answers and helped with the decision at hand.

Initially repeat each case three times. Vary wording and dates without changing the selected givens or expected behavior. Keep some variants out of prompt tuning. These are five reusable situations, not a matrix of new account setups.
