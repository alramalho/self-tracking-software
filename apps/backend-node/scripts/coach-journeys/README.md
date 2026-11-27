# Coach journeys

The coach in tracking.so is a tiny accountability nudge at the right moment. Too many messages, or ones that
ask nothing worth answering, teach people to ignore it. This benchmark checks both halves on a small set of
journeys: one person over one or two weeks, from the owner's own history (Oct–Nov 2026) and the other
situations every person meets (on track, gone quiet, travelling, lost motivation, sick, not sure, a hard
session, coaching off).

- **When** (`simulate.ts`, free, deterministic): the real scheduler (`decideMonitoring`), the real "at risk /
  gone quiet" drawer (`planAlert`, also on the phone and web), the real Talk to coach settling and its check-in
  pushes, hour by hour. Each journey says how many pushes are allowed, which must happen, and on which
  evenings the drawer must or must not be up. The weekly review may run at most once a week.
- **What** (`--live`, real model, run inside `tsw-backend`): every Talk to coach screen and every proactive
  message, written by the real prompts. Each text must ask at most one thing, stay short, offer no schedule
  change and never call the streak safe; journey rules add what must or must not be asked. A judge model then
  answers one question with the facts and the app's rules in hand: would a busy person be glad to get this?
  A text fails only if two independent judge reads reject it.

```
TZ=UTC node --import tsx scripts/coach-journeys/run.ts           # when
TZ=UTC node --import tsx scripts/coach-journeys/run.ts --live    # when + what (~$0.02)
```

## 27 Nov 2026

The owner, Friday 27 Nov, two Talk to coach answers on the phone:
- "I did a tattoo yesterday and I do not want to sweat…" → "Let the tattoo heal." and nothing changed: no pause, and the
  drawer would have come back Sunday, Monday and Tuesday while it healed.
- "I've been doing my Chinese almost daily, today maybe an hour…" → "Let's get it logged." → Log it → a recorder asking
  "What did you do?", the same thing again.

What changed:
- **Talk action `pause`**: only when their words say their body keeps them from it for days (injury, healing, a doctor's
  order). It is an offer ("Pause until Mon, Nov 30" / "Keep it running"); one tap pauses the plan through that day
  (`talk/pause.ts`), the card says "paused until …", paused days plan nothing, the coach is quiet and checks in the
  morning it resumes. Soreness, tiredness, busy, travel and motivation never get one.
- **Log from their words** (`talk/logFromWords.ts`): when they did it, the voice-log extractor reads their answer with
  the plan's activities and Jev checks the whole list ("is this exactly what they said?"). All or nothing; "Log it"
  then saves in one tap. Otherwise the recorder, as before.

| | Before (live voice-backfill-20261126) | After |
| --- | --- | --- |
| When | 14/16 (owner-tattoo, injury-says-no fail) | 16/16 |
| What (live texts) | 27/27 | 25/27 → 12/12 on the affected journeys once the judge knew the pause rule |

`log-from-words.ts` (11 cases, live, ~$0.002): no case may put a wrong session on the card. Per-session Jev questions
scored correct sessions 0.46–0.72 and left partial cards (Mon + Thu of "every day since Monday"); one question on the
whole list scored right lists 0.77–0.97 and a range 0.10. Result 11/11 with no wrong card, recall 10/12. The extractor
alone was also never wrong here, so Jev is a safety net, not yet a proven catch.

```
TZ=UTC node --import tsx scripts/coach-journeys/log-from-words.ts
```

## 16 Nov 2026

The owner, Monday 16 Nov: "Your weekly review" on Home opened the chat at "Saw today's run came in short. Now
you're back, when's your next session?" They never asked for a weekly review: the coach works through the
Coach tab, not Home cards and chat messages.

- **No weekly review and no weekly check.** The Sunday slot only lets a coached training plan get its next two
  weeks of sessions designed ("Your next two weeks" on the Coach tab). An open review question closes without
  pausing the plan. The switches are gone from plan settings, onboarding and the paywall on both apps.
- **No coach card on Home.**
- **The conversation the generator sees is dated** ("[2026-11-11 Wed, 4 days ago] them: …").
- **The scheduled model sees its JSON schema.** DeepSeek has no structured outputs and guessed shapes
  (`{"messages": […]}` for a nudge, no lists when quiet); those runs failed and retried in production too.
- `owner-sunday-review` and `on-track` now expect no Sunday push. When: 12/12.

## 13 Nov 2026

The owner, Friday 13 Nov: the "train 4 times a week is at risk" drawer, again, with 3 of 4 done and two days
left, after answering "travelling" and "back, need to work" on earlier days.

| | Before (main e9ed7f86) | After |
| --- | --- | --- |
| When: journeys passing | 6/11 | 11/11 |
| Owner's journey: evenings the drawer is up / times answered | 14 of 14 / 4 | 7 of 14 / 2 |
| What: coach texts passing (two live runs) | not measured (first harness run 3/29) | 22/22 and 20/22 |

What changed:
- **The question drawer opens only when the week needs every remaining day** (`weekOnTheLine`); the plan
  card's dashed dots keep the earlier "cutting it close" rule. "1 session left · 2 days to go" no longer asks
  what got in the way.
- **Answering it holds for the rest of the week** (was: that day), and a missed week they already talked
  through isn't asked about again on Sunday.
- **After a trip** the coach checks in the morning after the return day, and nothing else asks for two more
  days (`quietThrough`), on the server and in the app.
- **Slipping needs a real slip**: a long gap and fewer than the target in the last 7 days. Four sessions then
  three quiet days is a rhythm.
- **Talk to coach** sees the last three weeks of messages, never re-asks what it was told, asks a repeat
  "busy" when the next session is, gives a sick person one warm line and no pressure, doesn't repeat itself,
  and doesn't say "I'll ask again" twice.
- **Weekly review stays quiet on a week that went to plan**; otherwise it names one concrete thing and asks
  what's next, never "how's it feeling?". Nudge and lapse use `daysSinceLastLog` from the snapshot instead of
  counting days, and quote the person's own words with the right attribution.

Live runs cost about $0.02 each; this session's runs together were under $0.25. `runs/` keeps the last live
reports. Still not covered: plan setup (`scripts/coach-monitoring/compare-models.cjs`), the chat coach
(`scripts/coach-benchmark`), session check-ins for plans with booked sessions.
